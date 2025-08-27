import http from 'http';
import { parseRequestParams } from './util/params.js';
import { createMcpServer } from './tools/mcpServer.js';
import { buildSseServer } from './sse/sseServer.js';

interface AuthConfig {
  protectedMode: boolean; // when true, require bearer token
  // static authorization server metadata (simplified). In a real impl these could be loaded or proxied.
  authorizationServers: string[]; // list of AS base URLs
  issuer?: string; // canonical issuer for metadata
  tokenAudience?: string; // expected audience/resource (canonical server URI)
}

function canonicalServerBase(opts: StartOptions): string {
  const scheme = 'http'; // if TLS added later, adjust
  const hostPort = `${opts.host}:${opts.port}`;
  return `${scheme}://${hostPort}`; // path component for canonical resource could be added if needed
}

function extractBearer(authHeader: string | string[] | undefined): string | null {
  if (!authHeader) return null;
  const h = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const m = /^Bearer\s+(.+)$/i.exec(h || '');
  return m ? m[1].trim() : null;
}

// Placeholder token validation: in real implementation verify signature/JWT audience.
// Advanced token validation (JWT + optional JWKS) – placeholder cryptographic verification (RSA only) if JWKS configured
import crypto from 'crypto';
interface JWKSKey { kid?: string; kty: string; n?: string; e?: string; alg?: string; }
let jwksCache: JWKSKey[] | null = null; let jwksFetchedAt = 0;
async function fetchJWKS(jwksUri: string): Promise<JWKSKey[]> {
  const now = Date.now();
  if (jwksCache && (now - jwksFetchedAt) < 300_000) return jwksCache;
  const resp = await fetch(jwksUri);
  if (!resp.ok) throw new Error('jwks fetch failed');
  const json: any = await resp.json();
  jwksCache = Array.isArray(json.keys) ? json.keys as JWKSKey[] : [];
  jwksFetchedAt = now; return jwksCache || [];
}
function b64uDecode(str: string) { str = str.replace(/-/g,'+').replace(/_/g,'/'); while (str.length % 4) str += '='; return Buffer.from(str,'base64'); }
function rsaPublicKeyFromModExp(nB64u: string, eB64u: string) {
  const n = b64uDecode(nB64u); const e = b64uDecode(eB64u);
  function derLen(buf: Buffer) { if (buf.length < 128) return Buffer.from([buf.length]); const hex = buf.length.toString(16).padStart((Math.ceil(buf.length.toString(16).length/2))*2,'0'); const bytes = hex.match(/.{1,2}/g)!.map(h=>parseInt(h,16)); return Buffer.from([0x80 | bytes.length, ...bytes]); }
  function derInt(buf: Buffer) { if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]); return Buffer.concat([Buffer.from([0x02]), derLen(buf), buf]); }
  const seq = Buffer.concat([derInt(n), derInt(e)]); const full = Buffer.concat([Buffer.from([0x30]), derLen(seq), seq]);
  const b64 = full.toString('base64').match(/.{1,64}/g)!.join('\n');
  return `-----BEGIN RSA PUBLIC KEY-----\n${b64}\n-----END RSA PUBLIC KEY-----`;
}
async function validateAccessToken(token: string, auth: AuthConfig, opts: StartOptions): Promise<boolean> {
  if (!token) return false;
  const parts = token.split('.');
  const isJWT = parts.length === 3;
  if (!isJWT) return !!opts.insecureUnsignedTokens; // allow opaque only if explicitly permitted
  let header: any; let payload: any;
  try { header = JSON.parse(b64uDecode(parts[0]).toString('utf8')); payload = JSON.parse(b64uDecode(parts[1]).toString('utf8')); } catch { return false; }
  // exp check
  if (typeof payload.exp === 'number' && Date.now()/1000 > payload.exp) return false;
  // aud check
  if (auth.tokenAudience) {
    const aud = payload.aud;
    if (Array.isArray(aud) ? !aud.includes(auth.tokenAudience) : aud !== auth.tokenAudience) return false;
  }
  if (auth.issuer && payload.iss && payload.iss !== auth.issuer) return false;
  if (!opts.jwksUri) return !!opts.insecureUnsignedTokens; // skip signature when no JWKS
  try {
    const keys = await fetchJWKS(opts.jwksUri);
    const kid = header.kid; const alg = header.alg || 'RS256';
    const key = keys.find(k => k.kty === 'RSA' && (!kid || k.kid === kid));
    if (!key || !key.n || !key.e) return false;
    if (!/^RS256$/i.test(alg)) return false; // only RS256
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(parts[0] + '.' + parts[1]); verifier.end();
    const sig = b64uDecode(parts[2]);
    const pem = rsaPublicKeyFromModExp(key.n, key.e);
    return verifier.verify(pem, sig);
  } catch { return false; }
}

function challenge(res: http.ServerResponse, opts: StartOptions, auth: AuthConfig) {
  res.statusCode = 401;
  const resourceMeta = canonicalServerBase(opts) + '/.well-known/oauth-protected-resource';
  // Minimal WWW-Authenticate challenge referencing protected resource metadata
  const params = [`resource_metadata="${resourceMeta}"`];
  if (auth.authorizationServers.length) params.push(`as="${auth.authorizationServers[0]}"`);
  res.setHeader('WWW-Authenticate', 'Bearer ' + params.join(', '));
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify({ error: 'unauthorized' }));
}

export interface StartOptions { host: string; port: number; debug: boolean; allowFile?: boolean; rateLimitStrategy?: 'fixed' | 'token-bucket'; streamMode?: 'off' | 'chunk'; streamThreshold?: number; nameCollisionMode?: 'suffix' | 'hash'; credStore?: 'memory' | 'file'; verboseNames?: boolean; protectedMode?: boolean; authIssuer?: string; authServer?: string; tokenAudience?: string; jwksUri?: string; insecureUnsignedTokens?: boolean; proxyRegister?: boolean; }

export async function startServer(opts: StartOptions) {
  const sseServer = buildSseServer({ debug: opts.debug });
  const serverInstances = new Map<string, any>(); // serverId -> MCPServer
  const auth: AuthConfig = {
    protectedMode: !!opts.protectedMode,
    authorizationServers: opts.authServer ? [opts.authServer] : [],
    issuer: opts.authIssuer || opts.authServer,
    tokenAudience: opts.tokenAudience || undefined
  };

  const server = http.createServer(async (req, res) => {
    if (!req.url) { res.statusCode = 400; res.end('Bad Request'); return; }
    const url = new URL(req.url, `http://${req.headers.host}`);

    function setCors() {
      const origin = req.headers.origin || '';
      // Allow only local origins for safety; expand if needed
      if (/^https?:\/\/localhost(?::\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    }

    if (req.method === 'OPTIONS') {
      setCors();
      res.statusCode = 204; res.end();
      return;
    }

    // Well-known endpoints for protected resource & authorization server metadata (simplified RFC9728 / RFC8414)
    if (url.pathname === '/.well-known/oauth-protected-resource' && req.method === 'GET') {
      setCors();
      const meta = {
        resource: canonicalServerBase(opts),
        authorization_servers: auth.authorizationServers,
        // minimal example; could include jwks_uri, resource_signing_algorithms_supported, etc.
      };
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify(meta));
      return;
    }
    if (url.pathname === '/.well-known/oauth-authorization-server' && req.method === 'GET') {
      // Return minimal AS metadata (in real-life you'd proxy the real AS metadata)
      setCors();
      if (!auth.authorizationServers.length) { res.statusCode = 404; res.end('Not configured'); return; }
      const asBase = auth.authorizationServers[0];
      const meta = {
        issuer: auth.issuer || asBase,
        authorization_endpoint: asBase.replace(/\/$/, '') + '/authorize',
        token_endpoint: asBase.replace(/\/$/, '') + '/token',
        grant_types_supported: ['authorization_code','client_credentials','refresh_token','device_code'],
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256'],
      };
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify(meta));
      return;
    }

    if (url.pathname === '/credentials' && req.method === 'POST') {
      setCors();
      // Simple JSON body: { server: string, scheme: string, token?: string, username?, password? }
      let body = '';
      req.on('data', c => { body += c; if (body.length > 50_000) req.destroy(); });
      req.on('end', async () => {
        try {
          const json = JSON.parse(body || '{}');
          const entries = Array.isArray(json.entries) ? json.entries : null;
          const { server: serverId, baseURL: bBaseURL, schemaURL: bSchemaURL, serverName: bServerName } = json;
          if (!serverId) { res.statusCode = 400; res.end(JSON.stringify({ error: 'server id required' })); return; }
          let inst = serverInstances.get(serverId);
          if (!inst && bBaseURL && bSchemaURL) {
            // Lazy create server with provided parameters if not already active
            try {
              const rawParams: any = { s: bSchemaURL, u: bBaseURL };
              if (bServerName) rawParams.n = bServerName;
              const parsed = await parseRequestParams(rawParams);
              (parsed as any).credStore = opts.credStore || 'memory';
              (parsed as any).simpleNames = false; // ensure deterministic naming with provided serverName
              const newInst = await createMcpServer(parsed, { debug: opts.debug, allowFile: !!opts.allowFile });
              serverInstances.set(newInst.id, newInst);
              inst = newInst.id === serverId ? newInst : undefined;
              if (opts.debug) console.log('[mcp] lazy server created via /credentials - server.ts:178', newInst.id);
            } catch (e:any) { if (opts.debug) console.warn('[mcp] lazy create failed - server.ts:179', e.message); }
          }
          if (!inst) { res.statusCode = 404; res.end(JSON.stringify({ error: 'server not found' })); return; }
          if (entries) {
            for (const e of entries) {
              const type = e.type;
              const schemeName = e.scheme || 'auth';
              if (type === 'bearer') {
                if (!e.token) continue;
        await (inst as any).setCredential(schemeName, { type: 'bearer', token: e.token });
              } else if (type === 'authorization-raw') {
                if (!e.token) continue;
                // Treat as apiKey header scheme; value used directly
        await (inst as any).setCredential(schemeName, { type: 'authorization-raw', value: e.token, in: 'header', name: e.headerName || 'Authorization' });
              } else if (type === 'api-key-header') {
                if (!e.value) continue;
        await (inst as any).setCredential(schemeName, { type: 'api-key-header', value: e.value, in: 'header', name: e.headerName || schemeName });
              } else if (type === 'basic') {
                if (!e.username || !e.password) continue;
        await (inst as any).setCredential(schemeName, { type: 'basic', username: e.username, password: e.password });
              } else if (type === 'custom-headers') {
                if (e.headers && typeof e.headers === 'object') {
                  for (const [hk,hv] of Object.entries(e.headers)) {
          await (inst as any).setCredential(hk, { type: 'custom-header', value: hv as any, in: 'header', name: hk });
                  }
                }
              }
            }
          } else {
            const { scheme = 'auth', token, username, password } = json || {};
            if (token) await (inst as any).setCredential(scheme, { token });
            else if (username && password) await (inst as any).setCredential(scheme, { username, password });
            else { res.statusCode = 400; res.end(JSON.stringify({ error: 'token or username/password required' })); return; }
          }
          res.setHeader('content-type','application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch (e:any) {
          res.statusCode = 400; res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
    if (url.pathname === '/import-env-credentials' && req.method === 'POST') {
      setCors();
      let body=''; req.on('data',c=>{body+=c; if (body.length>20_000) req.destroy();});
      req.on('end', async () => {
        try {
          // Support specifying server id explicitly
          const json = body ? JSON.parse(body) : {};
          const targetId: string | undefined = json.server;
          let inst = targetId ? serverInstances.get(targetId) : undefined;
          if (!inst) {
            // fallback last instance (legacy behavior)
            inst = [...serverInstances.values()].slice(-1)[0];
          }
          if (!inst) { res.statusCode = 404; res.end(JSON.stringify({ error: 'no server instance' })); return; }
          const prefix = json.prefix || 'OAS_MCP_';
          const schemes: Record<string, any> = (inst as any)._securitySchemes || {};
          let imported: string[] = [];
          for (const [name, def] of Object.entries<any>(schemes)) {
            if (def.type === 'http' && def.scheme === 'basic') {
              const u = process.env[prefix + name.toUpperCase() + '_USERNAME'];
              const p = process.env[prefix + name.toUpperCase() + '_PASSWORD'];
              if (u && p) { await (inst as any).setCredential(name, { username: u, password: p }); imported.push(name); }
            } else if (def.type === 'http' && def.scheme === 'bearer') {
              const t = process.env[prefix + name.toUpperCase() + '_TOKEN'];
              if (t) { await (inst as any).setCredential(name, { token: t }); imported.push(name); }
            } else if (def.type === 'apiKey') {
              const v = process.env[prefix + name.toUpperCase() + '_VALUE'] || process.env[prefix + name.toUpperCase() + '_TOKEN'];
              if (v) { await (inst as any).setCredential(name, { value: v }); imported.push(name); }
            } else if (def.type === 'oauth2') {
              const at = process.env[prefix + name.toUpperCase() + '_ACCESS_TOKEN'];
              if (at) { await (inst as any).setCredential(name, { accessToken: at }); imported.push(name); }
            }
          }
          res.setHeader('content-type','application/json');
          res.end(JSON.stringify({ ok: true, imported }));
        } catch (e:any) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
      });
      return;
    }
  if (url.pathname === '/sse') {
      if (auth.protectedMode) {
        const token = extractBearer(req.headers['authorization']);
        const ok = token ? await validateAccessToken(token, auth, opts) : false;
        if (!ok) { challenge(res, opts, auth); return; }
      }
      await sseServer.handleSse(req, res, async (params) => {
  const parsed = await parseRequestParams(params);
  (parsed as any).rateLimitStrategy = opts.rateLimitStrategy || 'fixed';
  (parsed as any).streamMode = opts.streamMode || 'off';
  (parsed as any).streamThreshold = typeof opts.streamThreshold === 'number' ? opts.streamThreshold : 65536;
  (parsed as any).nameCollisionMode = opts.nameCollisionMode || 'suffix';
  (parsed as any).credStore = opts.credStore || 'memory';
  // simple (short) names are the default now; verboseNames opt-in
  (parsed as any).simpleNames = !opts.verboseNames;
  // Derive server ID to check for existing instance (same logic as createMcpServer)
  const simple = (parsed as any).simpleNames !== false;
  let derivedId: string;
  if ((parsed as any).serverName) {
    const rawName = String((parsed as any).serverName);
    let clean = rawName.replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'custom';
    derivedId = 'oas_mcp_' + clean;
  } else if (simple) derivedId = 'oas_mcp';
  else {
    let baseId = 'server';
    if (parsed.baseURL) {
      try {
        const u = new URL(parsed.baseURL);
        const hostPart = u.hostname.split('.').slice(-2).join('_') || u.hostname.replace(/\./g,'_');
        const firstSeg = u.pathname.split('/').filter(Boolean)[0];
        baseId = [hostPart, firstSeg].filter(Boolean).join('_');
      } catch {/* ignore */}
    }
    derivedId = 'oas_mcp_' + baseId.replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  }
  // Reuse existing instance if available, otherwise create new
  let inst = serverInstances.get(derivedId);
  if (!inst) {
    inst = await createMcpServer(parsed, { debug: opts.debug, allowFile: !!opts.allowFile });
    serverInstances.set(inst.id, inst);
    if (opts.debug) console.log('[sse] created new server instance  SSE1 - server.ts:300', inst.id);
  } else {
    if (opts.debug) console.log('[sse] reusing existing server instance  SSE2 - server.ts:302', inst.id);
  }
  // Auto-import environment credentials once (best-effort)
  try {
    if ((inst as any)._securitySchemes) {
      const imported: string[] = [];
      const schemes: Record<string, any> = (inst as any)._securitySchemes;
      const prefix = 'OAS_MCP_';
      for (const [name, def] of Object.entries<any>(schemes)) {
        if (def.type === 'http' && def.scheme === 'basic') {
          const u = process.env[prefix + name.toUpperCase() + '_USERNAME'];
          const p = process.env[prefix + name.toUpperCase() + '_PASSWORD'];
          if (u && p) { await (inst as any).setCredential(name, { username: u, password: p }); imported.push(name); }
        } else if (def.type === 'http' && def.scheme === 'bearer') {
          const t = process.env[prefix + name.toUpperCase() + '_TOKEN'];
          if (t) { await (inst as any).setCredential(name, { token: t }); imported.push(name); }
        } else if (def.type === 'apiKey') {
          const v = process.env[prefix + name.toUpperCase() + '_VALUE'] || process.env[prefix + name.toUpperCase() + '_TOKEN'];
          if (v) { await (inst as any).setCredential(name, { value: v }); imported.push(name); }
        } else if (def.type === 'oauth2') {
          const at = process.env[prefix + name.toUpperCase() + '_ACCESS_TOKEN'];
          if (at) { await (inst as any).setCredential(name, { accessToken: at }); imported.push(name); }
        }
      }
      if (imported.length && opts.debug) console.log('[cred] autoimported env schemes - server.ts:326', imported);
    }
  } catch (e:any) { if (opts.debug) console.warn('[cred] autoimport env failed - server.ts:328', e.message); }
  return inst;
      });
      return;
    }
    if (url.pathname === '/message') {
  setCors();
      if (auth.protectedMode) {
        const token = extractBearer(req.headers['authorization']);
        const ok = token ? await validateAccessToken(token, auth, opts) : false;
        if (!ok) { challenge(res, opts, auth); return; }
      }
      await sseServer.handleMessage(req, res);
      return;
    }
    // Dynamic client registration proxy
    if (auth.protectedMode && opts.proxyRegister && url.pathname === '/register' && req.method === 'POST' && opts.authServer) {
      setCors();
      let body='';
      req.on('data', c => { body += c; if (body.length > 200_000) req.destroy(); });
      req.on('end', async () => {
        try {
          const target = opts.authServer!.replace(/\/$/, '') + '/register';
          const resp = await fetch(target, { method:'POST', headers: { 'content-type':'application/json' }, body });
          const text = await resp.text();
          res.statusCode = resp.status; res.setHeader('content-type', resp.headers.get('content-type') || 'application/json'); res.end(text);
        } catch (e:any) { res.statusCode = 502; res.end(JSON.stringify({ error: 'register proxy failure', detail: e.message })); }
      });
      return;
    }
    res.statusCode = 404; res.end('Not Found');
  });

  server.listen(opts.port, opts.host, () => {
    console.log(`Server listening on ${opts.host}:${opts.port} - server.ts:362`);
  });
}
