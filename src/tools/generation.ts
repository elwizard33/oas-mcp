import crypto from 'node:crypto';
import { sanitizeToolName } from '../util/sanitize.js';
import type { MCPServer } from './mcpServer.js';
import type { ParsedParams } from '../util/params.js';
import type { HttpResponseEnvelope } from '../types/shared.js';
import { parseSSE, streamResponse } from './streaming.js';
// File request/response logging removed per user request.

// Summarize subschemas for oneOf/anyOf display
function summarizeSchema(s: any) {
  const summary: any = {};
  if (s.type) summary.type = s.type;
  if (s.description) summary.description = s.description;
  if (s.properties) summary.properties = Object.fromEntries(Object.entries(s.properties).map(([k,v]: any) => [k, { type: (v as any).type, description: (v as any).description }]));
  return summary;
}

export function buildInputSchema(ep: any) {
  const obj: any = { type: 'object', properties: {}, required: [] as string[] };
  if (ep.parameters?.length) {
    const query: any = { type: 'object', properties: {} }; const path: any = { type: 'object', properties: {} };
    for (const p of ep.parameters) {
      const target = p.in === 'path' ? path : p.in === 'query' ? query : null;
      if (!target) continue;
      target.properties[p.name!] = { type: p.schema?.type || 'string', description: p.description };
      if (p.required) { target.required = target.required || []; target.required.push(p.name); }
    }
    if (Object.keys(query.properties).length) obj.properties.searchParams = query;
    if (Object.keys(path.properties).length) obj.properties.pathNames = path;
  }
  if (ep.requestBody) {
    let schema: any = undefined;
    const content = ep.requestBody.content || {};
    const preferred = Object.keys(content).find(ct => /json|\+json/i.test(ct)) || Object.keys(content)[0];
    if (preferred) schema = content[preferred]?.schema;
    if (schema) {
      const out: any = { ...schema };
      if (schema.oneOf) out.oneOf = schema.oneOf.map((s:any) => summarizeSchema(s));
      if (schema.anyOf) out.anyOf = schema.anyOf.map((s:any) => summarizeSchema(s));
      if (schema._mergedAllOf) out.xMergedAllOf = true;
      if (schema.discriminator) {
        out.xDiscriminator = {
          propertyName: schema.discriminator.propertyName,
          mappingKeys: schema.discriminator.mapping ? Object.keys(schema.discriminator.mapping) : undefined,
          mapping: schema.discriminator.mapping
        };
      }
      obj.properties.requestBody = out;
    } else {
      obj.properties.requestBody = { type: 'object' };
    }
  }
  obj.properties.retryPolicy = {
    type: 'object',
    description: 'Optional per-call retry policy override',
    properties: {
      maxRetries: { type: 'integer', description: 'Number of retry attempts (default 2 for GET, else 0)' },
      baseDelayMs: { type: 'integer', description: 'Base delay in ms (default 100)' },
      factor: { type: 'number', description: 'Exponential backoff factor (default 2)' },
      jitterPct: { type: 'number', description: 'Random jitter percentage 0-1 (default 0.5)' },
      retryOnMethods: { type: 'array', items: { type: 'string' }, description: 'HTTP methods eligible for retry (default ["GET"])' },
      retryOnStatuses: { type: 'array', items: { type: 'integer' }, description: 'Status codes to retry (default none; only network errors retried)' }
    }
  };
  return obj;
}

function buildEndpointToolName(baseId: string, ep: any, params: ParsedParams, existing: (name:string)=>boolean) {
  // Prefer operationId if present and not too long
  let core = ep.operationId && ep.operationId.length <= 60 ? ep.operationId : undefined;
  if (!core) {
    // Build from method + last 2 non-empty path segments
    const segs = ep.path.split('/').filter(Boolean);
    const last = segs.slice(-2).join('_');
    core = `${ep.method.toLowerCase()}_${last || 'root'}`;
  }
  core = sanitizeToolName(core);
  let name = baseId === 'oas_mcp' ? `${baseId}_${core}` : `${baseId}_${core}`; // same pattern; retained for clarity if future adjusts
  // Handle collisions respecting nameCollisionMode
  const mode = (params as any).nameCollisionMode || 'suffix';
  if (existing(name)) {
    if (mode === 'hash') {
      const h = crypto.createHash('sha256').update(`${ep.method}:${ep.path}`).digest('hex').slice(0,6);
      name = `${baseId}_${core}_${h}`;
      let counter = 2; while (existing(name)) name = `${baseId}_${core}_${h}_${counter++}`;
    } else {
      let counter = 2; while (existing(name)) name = `${baseId}_${core}_${counter++}`;
    }
  }
  return name;
}

export function registerEndpoints(server: MCPServer, id: string, parsed: any, params: ParsedParams, debug: boolean, hostAllowed: (h:string)=>boolean) {
  let endpoints = parsed.endpoints;
  // Filtering already handled before call (call site provides filtered list if needed)
  for (const ep of endpoints) {
    server.registerLazy(() => {
      const toolName = buildEndpointToolName(id, ep, params, (n) => (server as any).tools?.has(n));
      // Build richer description
      const parts: string[] = [];
      if (ep.summary) parts.push(ep.summary.trim());
      else if (ep.operationId) parts.push(ep.operationId.trim());
      if (!parts.length && ep.description) {
        // take first sentence of description
        const firstSentence = String(ep.description).split(/(?<=[.!?])\s+/)[0].trim();
        if (firstSentence) parts.push(firstSentence);
      }
      if (!parts.length) {
        // fallback heuristic from path and method
        const segs = ep.path.split('/').filter(Boolean).slice(-2).join(' ');
        parts.push(`${ep.method.toUpperCase()} ${segs || 'root'} endpoint`);
      }
      const description = parts.join(' - ');
      server.addTool({
        name: toolName,
        description,
        input: buildInputSchema(ep),
        security: ep.security,
        handler: async (call): Promise<HttpResponseEnvelope | any> => {
          function finalize(result: any) {
            // Attach a MCP-compatible content array if missing
            if (!result || typeof result !== 'object') return { content: [{ type: 'text', text: String(result) }], data: result };
            const isError = !!(result.error);
            if (!Array.isArray((result as any).content)) {
              let textPiece = '';
              if (result.json) textPiece = JSON.stringify(result.json, null, 2);
              else if (typeof result.body === 'string') textPiece = result.body;
              else if (result.error) textPiece = typeof result.error === 'string' ? result.error : JSON.stringify(result.error, null, 2);
              else textPiece = JSON.stringify(result, null, 2);
              (result as any).content = [{ type: 'text', text: textPiece }];
            }
            (result as any).isError = isError;
            return result;
          }
          const args = (call && typeof call === 'object' && 'arguments' in call ? (call as any).arguments : call) || {};
          const limit = args.rateLimitPerMinute && Number.isFinite(+args.rateLimitPerMinute) ? +args.rateLimitPerMinute : 120;
          const strategy = (params as any).rateLimitStrategy || 'fixed';
          const metricsMap = (server as any).metrics as Map<string, any>;
          const nowRL = Date.now();
          let mRec = metricsMap.get(toolName);
          if (!mRec) { mRec = { calls:0, errors:0, lastCallMs:0, windowStart:nowRL, windowCount:0, windowErrors:0, currentSuccessStreak:0, currentFailureStreak:0, latencies: [] as number[] }; metricsMap.set(toolName, mRec); }
          if (strategy === 'fixed') {
            if (nowRL - mRec.windowStart >= 60_000) { mRec.windowStart = nowRL; mRec.windowCount = 0; mRec.windowErrors = 0; }
            if (mRec.windowCount + 1 > limit) {
              return finalize({ error: { type: 'rate_limit', message: `Rate limit exceeded (${limit}/min)` } });
            }
            mRec.windowCount++;
          } else if (strategy === 'token-bucket') {
            if (!mRec.bucket) {
              const capacity = limit;
              mRec.bucket = { capacity, tokens: capacity, lastRefill: nowRL, refillPerSec: capacity/60 };
            }
            const elapsedSec = (nowRL - mRec.bucket.lastRefill)/1000;
            if (elapsedSec > 0) {
              const add = elapsedSec * mRec.bucket.refillPerSec;
              mRec.bucket.tokens = Math.min(mRec.bucket.capacity, mRec.bucket.tokens + add);
              mRec.bucket.lastRefill = nowRL;
            }
            if (mRec.bucket.tokens < 1) {
              return finalize({ error: { type: 'rate_limit', message: `Rate limit exceeded (token bucket empty, capacity ${mRec.bucket.capacity})` } });
            }
            mRec.bucket.tokens -= 1;
            mRec.windowCount++;
          }
          let url = params.baseURL!.replace(/\/$/, '') + ep.path;
          const pathNames = args.pathNames || {};
          if (ep.parameters) {
            const missing: string[] = [];
            for (const p of ep.parameters) {
              if (p.in === 'path' && p.required) {
                const val = pathNames[p.name!];
                if (val === undefined || val === null || val === '') missing.push(p.name!);
              }
            }
            if (missing.length) {
              return finalize({ error: { type: 'input', message: `Missing required path parameter(s): ${missing.join(', ')}` } });
            }
          }
          for (const [k,v] of Object.entries(pathNames)) url = url.replace(new RegExp(`{${k}}`, 'g'), encodeURIComponent(String(v)));
          const searchParams = new URLSearchParams();
          if (args.searchParams) {
            const queryParamMeta: Record<string, any> = {};
            if (ep.parameters) {
              for (const p of ep.parameters) if (p.in === 'query' && p.name) queryParamMeta[p.name] = p;
            }
            for (const [k,v] of Object.entries<any>(args.searchParams)) {
              if (v === undefined || v === null) continue;
              const meta = queryParamMeta[k];
              if (Array.isArray(v)) {
                const style = meta?.style || 'form';
                const explode = meta?.explode !== undefined ? meta.explode : true;
                if (style === 'form') {
                  if (explode) for (const item of v) searchParams.append(k, String(item));
                  else searchParams.append(k, v.map(x => String(x)).join(','));
                } else if (style === 'spaceDelimited') searchParams.append(k, v.map(x => String(x)).join(' '));
                else if (style === 'pipeDelimited') searchParams.append(k, v.map(x => String(x)).join('|'));
                else if (style === 'simple') searchParams.append(k, v.map(x => String(x)).join(','));
                else for (const item of v) searchParams.append(k, String(item));
              } else searchParams.append(k, String(v));
            }
          }
          if ([...searchParams.keys()].length) url += (url.includes('?') ? '&' : '?') + searchParams.toString();
          let body: any = undefined; let contentTypeHeader = 'application/json';
          if (args.requestBody !== undefined) {
            const content = ep.requestBody?.content || {};
            const mediaTypes = Object.keys(content);
            let chosen = mediaTypes.find(ct => /json|\+json/i.test(ct))
              || mediaTypes.find(ct => ct === 'application/x-www-form-urlencoded')
              || mediaTypes.find(ct => /multipart\/form-data/i.test(ct))
              || mediaTypes[0];
            if (!chosen) body = JSON.stringify(args.requestBody);
            else if (/json|\+json/i.test(chosen)) body = JSON.stringify(args.requestBody);
            else if (chosen === 'application/x-www-form-urlencoded') {
              const sp = new URLSearchParams();
              for (const [k,v] of Object.entries<any>(args.requestBody)) if (v !== undefined && v !== null) sp.append(k, String(v));
              body = sp.toString(); contentTypeHeader = 'application/x-www-form-urlencoded';
            } else if (/multipart\/form-data/i.test(chosen)) {
              const form = new FormData();
              for (const [k,v] of Object.entries<any>(args.requestBody)) {
                if (v === undefined || v === null) continue;
                if (v && typeof v === 'object' && ('stream' in v || ('content' in v) || ('value' in v))) {
                  const filename = (v as any).filename || 'file';
                  const streamLike = (v as any).stream;
                  const fileContent = streamLike || (v as any).content || (v as any).value;
                  if (fileContent instanceof Blob) form.append(k, fileContent as any, filename);
                  else if (typeof fileContent === 'string') form.append(k, new Blob([fileContent]), filename);
                  else if (fileContent instanceof Uint8Array || fileContent instanceof ArrayBuffer) {
                    const u8 = fileContent instanceof Uint8Array ? Buffer.from(fileContent) : Buffer.from(new Uint8Array(fileContent as ArrayBuffer));
                    form.append(k, new Blob([u8]), filename);
                  } else if (fileContent && (typeof (fileContent as any).pipe === 'function' || Symbol.asyncIterator in fileContent)) form.append(k, fileContent as any, filename);
                  else form.append(k, JSON.stringify(fileContent));
                } else form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
              }
              body = form; contentTypeHeader = undefined as any;
            } else body = JSON.stringify(args.requestBody);
          }
          const allCreds = (server as any).getAllCredentials?.() || {};
          const reqs: any[] = Array.isArray(ep.security) ? ep.security : [];
          // Option B aliasing: map generic 'auth' credential to concrete scheme names if needed.
          const workingCreds: Record<string, any> = { ...allCreds };
          if (workingCreds.auth) {
            const schemeNames = Object.keys(parsed.securitySchemes || {});
            if (schemeNames.length === 1 && !workingCreds[schemeNames[0]]) {
              workingCreds[schemeNames[0]] = workingCreds.auth;
              if (debug) console.log('[cred] aliased generic "auth" > - generation.ts:245', schemeNames[0], '- generation.ts:ALIAS1');
            } else {
              for (const r of reqs) {
                const keys = Object.keys(r || {});
                if (keys.length === 1) {
                  const k = keys[0];
                  if (!workingCreds[k]) { workingCreds[k] = workingCreds.auth; if (debug) console.log('[cred] aliased generic "auth" > - generation.ts:251', k, '- generation.ts:ALIAS2'); }
                }
              }
            }
          }
          let chosenReq: any = undefined;
          for (const r of reqs) { if (Object.keys(r).every(sch => workingCreds[sch])) { chosenReq = r; break; } }
          const extraHeaders: Record<string,string> = {}; const extraQuery: Record<string,string> = {}; const extraCookies: string[] = [];
          if (debug && (!chosenReq && reqs.length)) {
            console.log('[cred] no matching credential set found. Endpoint security requires one of: - generation.ts:260', reqs.map(r=>Object.keys(r).join('+')));
            console.log('[cred] available stored credentials: - generation.ts:261', Object.keys(workingCreds));
          }
          if (chosenReq && debug) { console.log('[cred] chosen security requirement - generation.ts:263', Object.keys(chosenReq)); }
          if (chosenReq) {
            for (const schemeName of Object.keys(chosenReq)) {
              const cred = workingCreds[schemeName]; if (!cred) continue;
              const schemeDef = parsed.securitySchemes?.[schemeName]; if (!schemeDef) continue;
              // Direct header credential override: if credential explicitly specifies header injection, honor it and skip scheme-derived formatting
              if (cred && typeof cred === 'object' && cred.in === 'header' && cred.name && cred.value) {
                extraHeaders[cred.name] = cred.value; // raw value, no Bearer added
                continue;
              }
              if (schemeDef.type === 'apiKey') {
                if (schemeDef.in === 'header') extraHeaders[schemeDef.name || schemeName] = cred.value || cred.token || cred.accessToken || cred;
                else if (schemeDef.in === 'query') extraQuery[schemeDef.name || schemeName] = cred.value || cred.token || cred.accessToken || cred;
                else if (schemeDef.in === 'cookie') extraCookies.push(`${schemeDef.name || schemeName}=${encodeURIComponent(cred.value || cred.token || cred.accessToken || cred)}`);
              } else if (schemeDef.type === 'http' && schemeDef.scheme === 'basic') {
                if (cred.username && cred.password) extraHeaders['Authorization'] = `Basic ${Buffer.from(`${cred.username}:${cred.password}`).toString('base64')}`;
              } else if (schemeDef.type === 'http' && schemeDef.scheme === 'bearer') {
                const token = cred.token || cred.accessToken || cred.value;
                if (token) {
                  const looksPrefixed = /^Bearer\s+/i.test(token);
                  const rawPreferred = cred.type === 'authorization-raw' || cred.type === 'api-key-header' || /^mga_[A-Za-z0-9]/.test(token);
                  extraHeaders['Authorization'] = rawPreferred ? token : (looksPrefixed ? token : `Bearer ${token}`);
                }
              } else if (schemeDef.type === 'oauth2') {
                if (cred) await (server as any).refreshOAuthTokenIfNeeded(schemeName, fetch);
                const token = (server as any).getCredentialRaw(schemeName)?.accessToken || cred.accessToken || cred.token;
                if (token) {
                  const looksPrefixed = /^Bearer\s+/i.test(token);
                  extraHeaders['Authorization'] = looksPrefixed ? token : `Bearer ${token}`;
                }
              }
            }
          }
          for (const [k,v] of Object.entries(extraQuery)) url += (url.includes('?') ? '&' : '?') + `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`;
          if (extraCookies.length) extraHeaders['Cookie'] = extraCookies.join('; ');
          const start = Date.now();
          if (debug) console.log(`[tool:${toolName}] > ${ep.method} ${url} - generation.ts:299`);
          try { const tmp = new URL(url); if (!hostAllowed(tmp.hostname)) return { error: { type: 'security', message: 'Target host blocked by SSRF policy' } }; } catch {}
          if (debug && Object.keys(extraHeaders).some(h=>h.toLowerCase()==='authorization')) {
            console.log('[cred] injecting authorization header for tool - generation.ts:302', toolName);
          }
          const controller = new AbortController();
          const timeoutMs = args.timeoutMs && Number.isFinite(+args.timeoutMs) ? +args.timeoutMs : 10000;
          const timeout = setTimeout(() => controller.abort(), timeoutMs);
          const rp = args.retryPolicy || {};
          const retryOnMethods: string[] = Array.isArray(rp.retryOnMethods) && rp.retryOnMethods.length ? rp.retryOnMethods.map((m:string)=>m.toUpperCase()) : ['GET'];
          const retryOnStatuses: number[] = Array.isArray(rp.retryOnStatuses) && rp.retryOnStatuses.length ? rp.retryOnStatuses.map((n:number)=>+n) : [];
          const baseDelayMs = Number.isFinite(+rp.baseDelayMs) ? +rp.baseDelayMs : 100;
          const factor = Number.isFinite(+rp.factor) && +rp.factor > 0 ? +rp.factor : 2;
          const jitterPct = Number.isFinite(+rp.jitterPct) ? Math.min(Math.max(+rp.jitterPct,0),1) : 0.5;
          const methodEligible = retryOnMethods.includes(ep.method.toUpperCase());
          const maxRetries = Number.isFinite(+rp.maxRetries) ? +rp.maxRetries : (ep.method === 'GET' ? 2 : 0);
          let attempt = 0; let resp: Response | undefined; let lastErr: any; let lastDelay = 0; let retriesPerformed = 0;
          while (attempt <= maxRetries) {
            try {
              const headers: Record<string,string> = { ...server.getDefaultHeaders(), ...extraHeaders };
              if (contentTypeHeader) headers['Content-Type'] = contentTypeHeader;
              resp = await fetch(url, { method: ep.method, headers, body, signal: controller.signal });
              if (!methodEligible) break;
              if (attempt === maxRetries) break;
              if (!resp.ok && retryOnStatuses.includes(resp.status)) {
                attempt++; retriesPerformed++;
                const base = baseDelayMs * Math.pow(factor, attempt-1);
                const jitter = base * jitterPct * Math.random();
                lastDelay = Math.round(base + jitter);
                await new Promise(r => setTimeout(r, lastDelay));
                continue;
              }
              break;
            } catch (e: any) {
              lastErr = e;
              if (e.name === 'AbortError') { clearTimeout(timeout); return { error: { type: 'timeout', message: `Request aborted after ${timeoutMs}ms`, attempt, cause: 'AbortError' } }; }
              if (!methodEligible || attempt === maxRetries) break;
              attempt++; retriesPerformed++;
              const base = baseDelayMs * Math.pow(factor, attempt-1);
              const jitter = base * jitterPct * Math.random();
              lastDelay = Math.round(base + jitter);
              await new Promise(r => setTimeout(r, lastDelay));
              continue;
            }
          }
          clearTimeout(timeout);
          if (!resp) {
            const netErr = { error: { type: 'network', message: lastErr?.message || 'Unknown network error', attempt: maxRetries, cause: lastErr?.name || 'NetworkError', retryDelayMs: lastDelay } };
            return finalize(netErr);
          }
          const elapsedMs = Date.now() - start;
          const headersObj: Record<string,string> = {}; for (const [hk,hv] of (resp.headers as any).entries()) headersObj[hk] = hv;
          const contentType = resp.headers.get('content-type') || '';
          const contentLengthHeader = resp.headers.get('content-length');
          const declaredLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : undefined;
          const streamMode = (params as any).streamMode || 'off';
            const threshold = (params as any).streamThreshold || 64 * 1024;
            const canStream = streamMode === 'chunk' && (declaredLength === undefined || declaredLength > threshold);
            if (canStream && (resp.body as any)?.getReader) return await streamResponse(server as any, resp, toolName, elapsedMs, headersObj, debug);
          let rawText: string | undefined; let json: any = undefined; let base64: string | undefined; const result: any = { status: resp.status, ok: resp.ok, headers: headersObj, body: undefined as any, elapsedMs };
          try {
            if (/text\/event-stream/i.test(contentType)) { rawText = await resp.text(); result.sse = parseSSE(rawText); }
            else if (/application\/json|\+json/i.test(contentType)) { rawText = await resp.text(); try { json = rawText ? JSON.parse(rawText) : undefined; } catch {} }
            else if (/^text\//i.test(contentType)) rawText = await resp.text();
            else {
              const buf = new Uint8Array(await resp.arrayBuffer());
              if (buf.byteLength <= 128 * 1024) base64 = Buffer.from(buf).toString('base64'); else rawText = `[[binary ${buf.byteLength} bytes omitted]]`;
            }
          } catch (e:any) { const out = finalize({ status: resp.status, ok: resp.ok, headers: headersObj, error: { type: 'read', message: e.message } }); return out; }
          result.body = rawText; if (json !== undefined) result.json = json; if (base64) result.base64 = base64; if (!resp.ok) result.error = { type: 'http', message: `HTTP ${resp.status}`, status: resp.status, attempt };
          (server as any).record(toolName, resp.ok, elapsedMs);
          if (debug) console.log(`[tool:${toolName}] < ${resp.status} (${elapsedMs}ms) - generation.ts:370`);
          if (retriesPerformed) (result as any).retryAttempts = retriesPerformed;
          const finalized = finalize(result as HttpResponseEnvelope);
          return finalized;
        }
      });
    });
  }
}
