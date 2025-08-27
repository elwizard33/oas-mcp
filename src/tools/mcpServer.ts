import { sanitizeToolName } from '../util/sanitize.js';
import fs from 'fs/promises';
import path from 'path';
import { ParsedParams } from '../util/params.js';
import { loadAndParseOpenAPI } from '../openapi/parser.js';
import { matchGlob, parseFilterDSL, shouldInclude } from '../filters/dsl.js'; // may use later
import crypto from 'node:crypto';
import { ToolDescriptor } from '../types/shared.js';
import { recordMetric, snapshotMetrics, MetricRecord } from './metrics.js';
import { registerAuthTools } from './authTools.js';
import { parseSSE, streamResponse } from './streaming.js'; // still used for auth/metrics tools streaming? (parse retained for completeness)
import { registerEndpoints } from './generation.js';
import { buildCredentialStore, CredentialStore } from '../cred/store.js';

// ToolDescriptor now defined in shared types (Item 20)

export class MCPServer {
  private tools = new Map<string, ToolDescriptor>();
  private lazyEndpoints: (() => void)[] = []; // holds endpoint builders
  private lazyRealized = false;
  // Metrics map exposed (legacy name) for rate limiting logic; use helpers in metrics.ts
  private metrics = new Map<string, MetricRecord>();
  private defaultHeaders: Record<string,string> = {};
  private credentials: Record<string, any> = {}; // schemeName -> stored secret material
  // Streaming event listeners (added for full streaming passthrough feature)
  private streamListeners: ((evt: { streamId: string; event: string; data?: any }) => void)[] = [];
  private now() { return Date.now(); }
  private credStore: CredentialStore | null = null;
  constructor(public readonly id: string, private debug = false, credStore?: CredentialStore | null) {
    this.credStore = credStore || null;
  }

  addTool(desc: ToolDescriptor) { this.tools.set(desc.name, desc); }
  registerLazy(builder: () => void) { this.lazyEndpoints.push(builder); }
  private realizeLazyIfNeeded() {
    if (this.lazyRealized) return;
    for (const build of this.lazyEndpoints) build();
    this.lazyEndpoints = [];
    this.lazyRealized = true;
  }
  listTools() { this.realizeLazyIfNeeded(); return [...this.tools.values()].map(t => ({ name: t.name, description: t.description, input: t.input, security: t.security })); }
  async callTool(name: string, args: any): Promise<any> { this.realizeLazyIfNeeded(); const tool = this.tools.get(name); if (!tool) throw new Error(`Tool not found: ${name}`); return tool.handler(args); }

  // Wrapper methods kept for backward compatibility with existing handler code
  record(name: string, ok: boolean, elapsedMs?: number) { recordMetric(this.metrics, name, ok, elapsedMs); }
  getMetrics() { return snapshotMetrics(this.metrics); }
  setAuthToken(token: string) { this.defaultHeaders['authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`; }
  getDefaultHeaders() { return { ...this.defaultHeaders }; }
  async setCredential(scheme: string, value: any) { this.credentials[scheme] = value; await this.persistCredentials(); }
  async clearCredential(scheme: string) { delete this.credentials[scheme]; await this.persistCredentials(); }
  private async persistCredentials() {
    if (!this.credStore) return;
    try {
      // Load existing to support multi-server namespacing
      let existing: any = await this.credStore.load();
      // Heuristic: if existing contains any key starting with 'oas_' treat as namespaced map { serverId -> creds } or legacy single-server id.
      const hasNamespacedKeys = Object.keys(existing).some(k => k.startsWith('oas_'));
      if (hasNamespacedKeys && (existing[this.id] || Object.values(existing).some(v => {
        if (!v || typeof v !== 'object') return false;
        const obj = v as any;
        return ('token' in obj) || ('username' in obj) || ('accessToken' in obj);
      }))) {
        // Namespaced layout: update just this server id
        existing[this.id] = { ...this.credentials };
      } else if (Object.keys(existing).length && !hasNamespacedKeys) {
        // Legacy flat layout (schemeName -> value). Migrate: tuck under this.id and preserve legacy under __legacy for reference.
        existing = { [this.id]: { ...this.credentials }, __legacy: existing };
      } else {
        // Empty file – create fresh namespaced map
        existing = { [this.id]: { ...this.credentials } };
      }
      await this.credStore.save(existing);
      if (this.debug) console.log('[cred] persisted (namespaced) - mcpServer.ts:73', this.id, Object.keys(this.credentials));
    } catch (e) { if (this.debug) console.warn('[cred] save failed - mcpServer.ts:74', (e as any)?.message); }
  }
  async loadCredentials() {
    if (!this.credStore) return;
    try {
      const raw: any = await this.credStore.load();
      if (!raw || typeof raw !== 'object') { this.credentials = {}; return; }
      // If raw has this server id key treat as namespaced; else if raw has any oas_ keys treat as namespaced map; else treat as flat legacy.
      if (raw[this.id]) {
        this.credentials = { ...raw[this.id] };
      } else if (Object.keys(raw).some(k => k.startsWith('oas_'))) {
        // Namespaced but this server not yet present; adopt generic if only that exists
        if (this.id !== 'oas_mcp' && raw['oas_mcp'] && Object.keys(raw).filter(k => k.startsWith('oas_')).length === 1) {
          this.credentials = { ...raw['oas_mcp'] };
        } else {
          this.credentials = {};
        }
      } else if (raw.__legacy && typeof raw.__legacy === 'object') {
        // Post-migration access: use nested legacy only if server id creds absent
        this.credentials = {};
      } else {
        // Legacy flat (pre-namespacing) – load entire object
        this.credentials = { ...raw };
      }
      if (this.debug) console.log('[cred] loaded - mcpServer.ts:98', this.id, Object.keys(this.credentials));
    } catch (e) { if (this.debug) console.warn('[cred] load failed - mcpServer.ts:99', (e as any)?.message); }
  }
  listCredentialsMasked() {
    const out: Record<string, any> = {};
    for (const [k,v] of Object.entries(this.credentials)) {
      if (v == null) continue;
      if (typeof v === 'string') out[k] = mask(v);
      else if (typeof v === 'object') {
        // Special handling: basic auth objects { username, password }
        if ('username' in v && 'password' in v) {
          out[k] = { username: (v as any).username, password: mask(String((v as any).password)) };
        } else {
          out[k] = Object.fromEntries(Object.entries(v).map(([ck,cv]) => [ck, typeof cv === 'string' ? mask(cv) : cv]));
        }
      }
      else out[k] = '***';
    }
    return out;
  }
  getCredentialRaw(name: string) { return this.credentials[name]; }
  getAllCredentials() { return { ...this.credentials }; }
  // Register a listener for streaming events (start, chunk, end, error)
  onStreamEvent(listener: (evt: { streamId: string; event: string; data?: any }) => void) { this.streamListeners.push(listener); }
  // Internal emit helper
  private emitStreamEvent(evt: { streamId: string; event: string; data?: any }) {
    for (const l of this.streamListeners) {
      try { l(evt); } catch {/* ignore listener errors */}
    }
  }
  async ensureOAuthClientCredentialsToken(schemeName: string, schemeDef: any, fetchImpl: typeof fetch) {
    const cred = this.credentials[schemeName];
    if (!cred || !cred.clientId || !cred.clientSecret || !cred.tokenUrl) return; // not configured
    const soon = this.now() + 30_000; // 30s refresh buffer
    if (cred.accessToken && cred.expiresAt && cred.expiresAt > soon) return; // still valid
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');
    if (cred.scope) body.set('scope', cred.scope);
    const basic = Buffer.from(`${cred.clientId}:${cred.clientSecret}`).toString('base64');
    const resp = await fetchImpl(cred.tokenUrl, { method: 'POST', headers: { 'Authorization': `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    if (!resp.ok) return; // silent failure: injection will proceed without token
    let json: any; try { json = await resp.json(); } catch { return; }
    if (json.access_token) {
      const expiresIn = Number(json.expires_in) || 3600;
      cred.accessToken = json.access_token;
      cred.expiresAt = this.now() + expiresIn * 1000;
      this.credentials[schemeName] = cred;
    }
  }
  async refreshOAuthTokenIfNeeded(schemeName: string, fetchImpl: typeof fetch) {
    const cred = this.credentials[schemeName];
    if (!cred) return;
    const now = this.now();
    const soon = now + 30_000; // 30s buffer
    if (cred.accessToken && cred.expiresAt && cred.expiresAt > soon) return; // still valid
    // Client credentials: reuse existing logic
    if (cred.clientId && cred.clientSecret && cred.tokenUrl && !cred.refreshToken && cred.grantType !== 'authorization_code') {
      await this.ensureOAuthClientCredentialsToken(schemeName, {}, fetchImpl);
      return;
    }
    // Authorization code or device with refresh_token
    if (cred.refreshToken && cred.tokenUrl && cred.clientId) {
      try {
        const body = new URLSearchParams();
        body.set('grant_type', 'refresh_token');
        body.set('refresh_token', cred.refreshToken);
        body.set('client_id', cred.clientId);
        if (cred.clientSecret) body.set('client_secret', cred.clientSecret);
        if (cred.scope) body.set('scope', cred.scope);
        const resp = await fetchImpl(cred.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
        if (!resp.ok) return; // silent failure; calling code can surface stale token use
        let json: any; try { json = await resp.json(); } catch { return; }
        if (json.access_token) {
          const expiresIn = Number(json.expires_in) || 3600;
            cred.accessToken = json.access_token;
            cred.expiresAt = this.now() + expiresIn*1000;
            if (json.refresh_token) cred.refreshToken = json.refresh_token; // rotation
        }
      } catch { /* ignore */ }
    }
  }
}

function mask(s: string) { if (s.length <= 4) return '*'.repeat(s.length); return s.slice(0,2) + '***' + s.slice(-2); }

async function fetchSchema(schemaURL: string, allowFile: boolean): Promise<string> {
  if (/^data:/i.test(schemaURL)) {
    const comma = schemaURL.indexOf(',');
    if (comma === -1) throw new Error('Invalid data URL');
    const meta = schemaURL.substring(5, comma); // after 'data:'
    const dataPart = schemaURL.substring(comma + 1);
    if (meta.endsWith(';base64')) return Buffer.from(dataPart, 'base64').toString('utf8');
    return decodeURIComponent(dataPart);
  }
  if (/^https?:\/\//i.test(schemaURL)) {
    const resp = await fetch(schemaURL);
    if (!resp.ok) throw new Error(`Failed to download schema: ${resp.status}`);
    return await resp.text();
  }
  if (allowFile) {
    // Resolve relative to CWD; restrict to within CWD subtree
    const cwd = process.cwd();
    const resolved = path.resolve(cwd, schemaURL);
    if (!resolved.startsWith(cwd)) throw new Error('Refusing to read file outside working directory');
    const data = await fs.readFile(resolved, 'utf8');
    return data;
  }
  throw new Error('Local file schemas not supported (enable with --allow-file)');
}

export async function createMcpServer(params: ParsedParams, { debug, allowFile }: { debug: boolean; allowFile?: boolean }): Promise<MCPServer> {
  const simple = (params as any).simpleNames !== false; // default true
  let id: string;
  if ((params as any).serverName) {
    const rawName = String((params as any).serverName);
    let clean = sanitizeToolName(rawName);
    if (!clean) clean = rawName.replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'custom';
    id = 'oas_mcp_' + clean; // new naming convention
  } else if (simple) id = 'oas_mcp';
  else {
    let baseId = 'server';
    if (params.baseURL) {
      try {
        const u = new URL(params.baseURL);
        const hostPart = u.hostname.split('.').slice(-2).join('_') || u.hostname.replace(/\./g,'_');
        const firstSeg = u.pathname.split('/').filter(Boolean)[0];
        baseId = [hostPart, firstSeg].filter(Boolean).join('_');
      } catch {/* ignore */}
    }
    id = 'oas_mcp_' + sanitizeToolName(baseId);
  }
  const credStore = buildCredentialStore((params as any).credStore);
  const server = new MCPServer(id, debug, credStore);
  if (debug) console.log('[mcp] serverName param: - mcpServer.ts:231', (params as any).serverName, '=> server id', id);
  await server.loadCredentials();

  // SSRF: validate baseURL early if allowlist provided
  function isPrivateHost(host: string): boolean {
    const lower = host.toLowerCase();
    if (lower === 'localhost' || lower.endsWith('.local')) return true;
    // IPv4 literal
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a,b,c,d] = host.split('.').map(x=>+x);
      if (a === 10) return true; // 10.0.0.0/8
      if (a === 127) return true; // loopback
      if (a === 169 && b === 254) return true; // link-local
      if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
      if (a === 192 && b === 168) return true; // 192.168/16
    }
    // IPv6 simple checks
    if (host.startsWith('[')) {
      const h = host.replace(/^[[]|[]]$/g,'').toLowerCase();
      if (h === '::1' || h.startsWith('fd') || h.startsWith('fc') || h.startsWith('fe80:')) return true; // loopback/ULA/link-local
    }
    return false;
  }
  function hostAllowed(host: string): boolean {
    if (isPrivateHost(host)) return false;
    if (params.allowedDomains && params.allowedDomains.length) {
      return params.allowedDomains.some(dom => host === dom || host.endsWith('.'+dom));
    }
    return true; // no allowlist => permissive (still private blocked)
  }
  try {
    if (params.baseURL) {
      const u = new URL(params.baseURL);
      if (!hostAllowed(u.hostname)) {
        server.addTool({ name: id + '_error', description: 'Invalid baseURL host (blocked by SSRF policy)', handler: async () => ({ error: 'Blocked host' }) });
        return server;
      }
    }
  } catch {/* ignore invalid URL; handled later */}

  if (!params.schemaURL || !params.baseURL) {
    server.addTool({ name: id + '_ping', description: 'Ping test tool', handler: async () => ({ ok: true }) });
    return server;
  }

  let rawSchema: string | undefined;
  try {
    rawSchema = await fetchSchema(params.schemaURL, !!allowFile);
  } catch (e: any) {
    const msg = e?.message || 'Schema download error';
    server.addTool({
      name: id + '_error',
      description: 'Schema download error',
      handler: async () => ({ error: msg, schemaURL: params.schemaURL })
    });
    return server;
  }
  let parsed;
  try {
    parsed = await loadAndParseOpenAPI(rawSchema);
  } catch (e:any) {
    server.addTool({ name: id + '_error', description: 'Schema parse error', handler: async () => ({ error: e.message }) });
    return server;
  }

  // Register authentication / credential tools
  registerAuthTools(server, id, parsed);
  // Expose security schemes for later environment credential import
  (server as any)._securitySchemes = parsed.securitySchemes || {};

  // Apply filters if provided
  let endpoints = parsed.endpoints;
  if (params.filters.length) {
    const filterObjs = params.filters.flatMap(parseFilterDSL);
    endpoints = endpoints.filter(ep => shouldInclude(ep.path, ep.method, filterObjs));
  }

  // Register endpoint tools lazily via helper
  registerEndpoints(server, id, { ...parsed, endpoints }, params, debug, hostAllowed);
  if (debug) console.log(`[mcp] Registered ${endpoints.length} endpoint definitions (lazy) - mcpServer.ts:310`);
  server.addTool({
    name: id + '_diag',
    description: 'Diagnostics: counts and configuration info',
    handler: async () => ({
      endpointCount: endpoints.length,
      baseURL: params.baseURL,
      schemaURL: params.schemaURL,
      filtersApplied: params.filters,
      securitySchemes: Object.keys(parsed.securitySchemes || {}),
      hasRootSecurity: !!parsed.rootSecurity,
      timestamp: new Date().toISOString()
    })
  });
  // Metrics tool
  server.addTool({
    name: id + '_metrics',
    description: 'Return per-tool call metrics',
    handler: async () => ({ metrics: server.getMetrics() })
  });
  // Credential diagnostics tool
  server.addTool({
    name: id + '_auth_diag',
    description: 'Debug authentication setup: security schemes, stored credentials, and endpoint requirements',
    input: { type: 'object', properties: { toolName: { type: 'string', description: 'Optional: inspect specific tool security requirements' } }, required: [] },
    handler: async (call) => {
      const args = call?.arguments || {};
      const result: any = {
        serverId: server.id,
        securitySchemes: Object.entries(parsed.securitySchemes || {}).map(([name, def]) => ({ name, type: (def as any).type, scheme: (def as any).scheme, in: (def as any).in })),
        storedCredentials: Object.keys(server.getAllCredentials()).map(k => ({ scheme: k, hasValue: !!server.getCredentialRaw(k) })),
        rootSecurity: parsed.rootSecurity || []
      };
      if (args.toolName) {
        // Find the endpoint info for this tool (if it exists)
        const tools = server.listTools();
        const tool = tools.find(t => t.name === args.toolName);
        if (tool) {
          result.toolSecurity = (tool as any).security || 'no security info available';
        } else {
          result.error = `Tool ${args.toolName} not found. Available: ${tools.map(t => t.name).join(', ')}`;
        }
      }
      return result;
    }
  });
  // Auth token setter tool
  server.addTool({
    name: id + '_auth_set_token',
    description: 'Set bearer token for subsequent API calls',
    input: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] },
    handler: async (call) => { const token = call?.arguments?.token; if (!token) return { error: { type: 'input', message: 'token required' } }; server.setAuthToken(token); return { ok: true }; }
  });
  server.addTool({
    name: id + '_auth_clear_token',
    description: 'Clear bearer token',
    handler: async () => { server.setAuthToken(''); return { ok: true }; }
  });
  server.addTool({
    name: id + '_auth_refresh_token',
    description: 'Refresh all OAuth tokens that have refresh_token or client credentials configuration',
    handler: async () => {
      const creds = (server as any).getAllCredentials();
      for (const schemeName of Object.keys(creds)) {
        await (server as any).refreshOAuthTokenIfNeeded(schemeName, fetch);
      }
      return { ok: true };
    }
  });
  server.addTool({
    name: id + '_auth_list',
    description: 'List stored credential schemes (masked values)',
    handler: async () => ({ credentials: (server as any).listCredentialsMasked?.() || {} })
  });
  return server;
}

// buildInputSchema, summarizeSchema moved to generation.ts
