import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from 'zod';
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"; // convenience export
import { completable } from '@modelcontextprotocol/sdk/server/completable.js';
import { loadAndParseOpenAPI } from "../openapi/parser.js";
import { registerEndpoints } from "../tools/generation.js"; // reuse existing endpoint generation
import { ParsedParams } from "../util/params.js";
import { sanitizeToolName } from "../util/sanitize.js";
import { recordMetric, snapshotMetrics, MetricRecord } from "../tools/metrics.js";
import { registerAuthTools } from "../tools/authTools.js";

// This file provides a new implementation using official MCP SDK.
// We adapt existing endpoint generation by intercepting server.addTool calls.

interface BuildOptions { debug?: boolean; allowFile?: boolean; }

/** Adapter exposing minimal surface of legacy MCPServer required by generation.ts */
class LegacyAdapter {
  public readonly id: string;
  private metrics = new Map<string, MetricRecord>();
  private tools = new Map<string, { name: string; description?: string; input?: any; security?: any; handler: any }>();
  private credentials: Record<string, any> = {};
  private toolEnabled = new Map<string, boolean>();
  private toolRefs = new Map<string, any>();
  private toolVersion = 0;
  private notifyTimer: any = null;
  private resources = new Map<string, { name: string; description?: string; mimeType?: string; get: () => Promise<string> | string }>();
  private resourceHashes = new Map<string, string>();
  private prompts = new Map<string, { name: string; description?: string; args?: any; run: (args: any) => Promise<any> | any }>();
  private resVersion = 0; private promptVersion = 0; private resTimer: any = null; private promptTimer: any = null;
  constructor(id: string, private real: McpServer, private debug: boolean = false) { this.id = id; }
  private scheduleToolsChanged() {
    this.toolVersion++;
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      try { (this.real as any).sendNotification?.('notifications/tools/list_changed', { version: this.toolVersion }); } catch { /* ignore */ }
    }, 120); // debounce window
  }
  addTool(desc: { name: string; description?: string; input?: any; security?: any; handler: any }) {
    this.tools.set(desc.name, desc);
    const inputSchema = desc.input ? jsonSchemaToZod(desc.input) : undefined;
    this.toolEnabled.set(desc.name, true);
    const ref = this.real.registerTool(desc.name, {
      title: desc.description || desc.name,
      description: desc.description,
      inputSchema: inputSchema as any
    }, async (args: any) => {
      if (!this.toolEnabled.get(desc.name)) {
        return { content: [{ type: 'text', text: 'Tool disabled' }], isError: true };
      }
      const start = Date.now();
      try {
        const res = await desc.handler({ arguments: args });
        const elapsed = Date.now() - start;
        recordMetric(this.metrics, desc.name, !res?.error, elapsed);
        if (res && Array.isArray(res.content)) return res;
        return { content: [{ type: 'text', text: typeof res === 'string' ? res : JSON.stringify(res, null, 2) }] };
      } catch (e: any) {
        recordMetric(this.metrics, desc.name, false, Date.now() - start);
        return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
      }
    });
    this.toolRefs.set(desc.name, ref);
    this.scheduleToolsChanged();
  }
  listTools() { return [...this.tools.values()]; }
  listRegisteredTools() { return [...this.tools.keys()].map(name => ({ name, enabled: !!this.toolEnabled.get(name) })); }
  enableTool(name: string) { if (this.tools.has(name)) this.toolEnabled.set(name, true); this.toolRefs.get(name)?.enable?.(); this.scheduleToolsChanged(); }
  disableTool(name: string) { if (this.tools.has(name)) this.toolEnabled.set(name, false); this.toolRefs.get(name)?.disable?.(); this.scheduleToolsChanged(); }
  removeTool(name: string) { this.toolRefs.get(name)?.remove?.(); this.tools.delete(name); this.toolEnabled.delete(name); this.toolRefs.delete(name); this.scheduleToolsChanged(); }
  updateTool(name: string, cfg: any) { this.toolRefs.get(name)?.update?.(cfg); }
  getMetrics() { return snapshotMetrics(this.metrics); }
  record(name: string, ok: boolean, elapsedMs?: number, extra?: any) { recordMetric(this.metrics, name, ok, elapsedMs, extra); }
  setAuthToken(token: string) { this.credentials['auth'] = { token }; }
  getDefaultHeaders() { return {}; }
  async setCredential(scheme: string, value: any) { this.credentials[scheme] = value; }
  async clearCredential(scheme: string) { delete this.credentials[scheme]; }
  getAllCredentials() { return { ...this.credentials }; }
  getCredentialRaw(name: string) { return this.credentials[name]; }
  listCredentialsMasked() { return Object.fromEntries(Object.entries(this.credentials).map(([k,v]) => [k, typeof v === 'string' ? mask(v) : '[object]'])); }
  async refreshOAuthTokenIfNeeded(schemeName: string, fetchImpl: typeof fetch) {
    const cred = this.credentials[schemeName]; if (!cred) return;
    const now = Date.now(); const soon = now + 30_000;
    if (cred.accessToken && cred.expiresAt && cred.expiresAt > soon) return;
    if (cred.clientId && cred.clientSecret && cred.tokenUrl && !cred.refreshToken && cred.grantType !== 'authorization_code') {
      const body = new URLSearchParams(); body.set('grant_type','client_credentials'); if (cred.scope) body.set('scope', cred.scope);
      const basic = Buffer.from(`${cred.clientId}:${cred.clientSecret}`).toString('base64');
      const resp = await fetchImpl(cred.tokenUrl, { method:'POST', headers:{ 'Authorization':`Basic ${basic}`, 'Content-Type':'application/x-www-form-urlencoded' }, body: body.toString() });
      if (!resp.ok) return; let json: any; try { json = await resp.json(); } catch { return; }
      if (json.access_token) { const expiresIn = Number(json.expires_in)||3600; cred.accessToken = json.access_token; cred.expiresAt = now + expiresIn*1000; }
      return;
    }
    if (cred.refreshToken && cred.tokenUrl && cred.clientId) {
      try { const body = new URLSearchParams(); body.set('grant_type','refresh_token'); body.set('refresh_token', cred.refreshToken); body.set('client_id', cred.clientId); if (cred.clientSecret) body.set('client_secret', cred.clientSecret); if (cred.scope) body.set('scope', cred.scope); const resp = await fetchImpl(cred.tokenUrl, { method:'POST', headers:{ 'Content-Type':'application/x-www-form-urlencoded' }, body: body.toString() }); if (!resp.ok) return; let json:any; try { json = await resp.json(); } catch { return; } if (json.access_token) { const expiresIn = Number(json.expires_in)||3600; cred.accessToken = json.access_token; cred.expiresAt = now + expiresIn*1000; if (json.refresh_token) cred.refreshToken = json.refresh_token; } } catch { /* ignore */ }
    }
  }
  // Resource & prompt registry (fallback until native SDK methods exposed)
  registerResource(def: { name: string; description?: string; mimeType?: string; get: () => Promise<string> | string }) {
    this.resources.set(def.name, def); this.scheduleResChanged();
  }
  listResources() { return [...this.resources.values()].map(r => ({ name: r.name, description: r.description, mimeType: r.mimeType, uri: `oas://${r.name}` })); }
  getResource(name: string) { return this.resources.get(name); }
  registerPrompt(def: { name: string; description?: string; args?: any; run: (args: any) => Promise<any> | any }) { this.prompts.set(def.name, def); this.schedulePromptChanged(); }
  listPrompts() { return [...this.prompts.values()].map(p => ({ name: p.name, description: p.description })); }
  runPrompt(name: string, args: any) { return this.prompts.get(name)?.run(args); }
  private async computeResourceHashes(): Promise<string[]> {
    const changed: string[] = [];
    const crypto = await import('node:crypto');
    for (const [name, def] of this.resources.entries()) {
      try {
        const val = await def.get();
        const h = crypto.createHash('sha256').update(typeof val === 'string' ? val : JSON.stringify(val)).digest('hex');
        const prev = this.resourceHashes.get(name);
        if (h !== prev) { this.resourceHashes.set(name, h); changed.push(name); }
      } catch { /* ignore individual resource errors */ }
    }
    return changed;
  }
  private scheduleResChanged() { this.resVersion++; if (this.resTimer) return; this.resTimer = setTimeout(async ()=>{ this.resTimer=null; try { const changed = await this.computeResourceHashes(); if (changed.length) { (this.real as any).sendNotification?.('notifications/resources/list_changed', { version: this.resVersion, changed }); } } catch {} }, 160); }
  private schedulePromptChanged() { this.promptVersion++; if (this.promptTimer) return; this.promptTimer = setTimeout(()=>{ this.promptTimer=null; try { (this.real as any).sendNotification?.('notifications/prompts/list_changed', { version: this.promptVersion }); } catch {} }, 150); }
}

// Expanded JSON Schema -> Zod converter (enhanced)
function jsonSchemaToZod(s: any): z.ZodTypeAny | undefined {
  try {
    if (!s || typeof s !== 'object') return undefined;
    if (s.type === 'object' && s.properties) {
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [k,v] of Object.entries<any>(s.properties)) shape[k] = jsonSchemaToZod(v) || z.any();
      let obj = z.object(shape);
      if (s.additionalProperties === true) obj = obj.catchall(z.any());
      if (Array.isArray(s.required)) {
        for (const req of s.required) { if (shape[req]) shape[req] = shape[req]; }
      }
      return obj;
    }
    if (s.type === 'string') {
      let str = z.string();
      if (s.format) {
        if (s.format === 'email') str = str.email();
        else if (s.format === 'uuid') str = str.uuid();
        else if (s.format === 'uri' || s.format === 'url') str = str.url();
  else if (s.format === 'date-time' && (str as any).datetime) str = (str as any).datetime();
  else if (s.format === 'date') { /* basic date regex */ str = str.regex(/^\d{4}-\d{2}-\d{2}$/); }
  else if (s.format === 'time') { str = str.regex(/^\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:?\d{2})?$/); }
  else if (s.format === 'ipv4') { str = str.regex(/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/); }
  else if (s.format === 'ipv6') { str = str.regex(/^[0-9a-fA-F:]+$/); }
  else if (s.format === 'hostname') { str = str.regex(/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/); }
  else if (s.format === 'byte') { str = str.regex(/^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/); }
  else if (s.format === 'binary') { /* represent as any string; could refine */ }
      }
      if (typeof s.minLength === 'number') str = str.min(s.minLength);
      if (typeof s.maxLength === 'number') str = str.max(s.maxLength);
      if (s.pattern) { try { const re = new RegExp(s.pattern); str = str.regex(re); } catch { /* ignore */ } }
      if (Array.isArray(s.enum) && s.enum.length) return z.enum([s.enum[0], ...(s.enum.slice(1) as string[])] as [string, ...string[]]);
      if (s.default !== undefined) str = (str as any).default(s.default);
      return str;
    }
    if (s.type === 'number' || s.type === 'integer') {
      let num = z.number();
      if (typeof s.minimum === 'number') num = num.min(s.minimum);
      if (typeof s.maximum === 'number') num = num.max(s.maximum);
      if (s.default !== undefined) num = (num as any).default(s.default);
      return num;
    }
    if (s.type === 'boolean') return z.boolean();
    if (s.type === 'array' && s.items) { let arr = z.array(jsonSchemaToZod(s.items) || z.any()); if (typeof s.minItems==='number') arr = arr.min(s.minItems); if (typeof s.maxItems==='number') arr = arr.max(s.maxItems); return arr; }
    if (Array.isArray(s.oneOf)) return z.union(s.oneOf.map((c:any)=> jsonSchemaToZod(c) || z.any()) as any);
    if (Array.isArray(s.anyOf)) return z.union(s.anyOf.map((c:any)=> jsonSchemaToZod(c) || z.any()) as any);
    if (Array.isArray(s.allOf)) { const variants = s.allOf.map((c:any)=> jsonSchemaToZod(c) || z.any()); if (!variants.length) return z.any(); let combined: z.ZodTypeAny = variants[0]; for (let i=1;i<variants.length;i++) combined = (combined as any).and(variants[i]); return combined; }
    if ((s as any).nullable) return (jsonSchemaToZod({ ...s, nullable:false }) as any)?.nullable?.();
    if (s.default !== undefined) { try { return (jsonSchemaToZod({ ...s, default: undefined }) as any)?.default?.(s.default) || undefined; } catch { /* ignore */ } }
    return undefined;
  } catch { return undefined; }
}

function mask(s: string) { if (s.length <= 4) return '*'.repeat(s.length); return s.slice(0,2)+ '***' + s.slice(-2); }

async function fetchSchema(schemaURL: string, allowFile: boolean): Promise<string> {
  if (/^data:/i.test(schemaURL)) {
    const comma = schemaURL.indexOf(',');
    if (comma === -1) throw new Error('Invalid data URL');
    const meta = schemaURL.substring(5, comma);
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
    const { readFile } = await import('fs/promises');
    const { resolve } = await import('path');
    const cwd = process.cwd();
    const resolved = resolve(cwd, schemaURL);
    if (!resolved.startsWith(cwd)) throw new Error('Refusing to read file outside working directory');
    return await readFile(resolved, 'utf8');
  }
  throw new Error('Local file schemas not supported (enable with --allow-file)');
}

export interface BuildParams extends ParsedParams {}

export async function buildMcpSdkServer(params: BuildParams, opts: BuildOptions) {
  const debug = !!opts.debug;
  // Derive server id consistent with legacy logic
  const simple = (params as any).simpleNames !== false;
  let id: string;
  if ((params as any).serverName) {
    const rawName = String((params as any).serverName);
    let clean = sanitizeToolName(rawName);
    if (!clean) clean = rawName.replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'custom';
    id = 'oas_mcp_' + clean;
  } else if (simple) id = 'oas_mcp';
  else {
    let baseId = 'server';
    if (params.baseURL) {
      try {
        const u = new URL(params.baseURL);
        const hostPart = u.hostname.split('.').slice(-2).join('_') || u.hostname.replace(/\./g,'_');
        const firstSeg = u.pathname.split('/').filter(Boolean)[0];
        baseId = [hostPart, firstSeg].filter(Boolean).join('_');
      } catch {}
    }
    id = 'oas_mcp_' + sanitizeToolName(baseId);
  }

  const server = new McpServer({ name: id, version: '0.1.0' }, { debouncedNotificationMethods: ['notifications/tools/list_changed','notifications/resources/list_changed','notifications/prompts/list_changed'] });
  const adapter = new LegacyAdapter(id, server, debug);

  if (!params.schemaURL || !params.baseURL) {
    adapter.addTool({ name: id + '_ping', description: 'Ping test tool', handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });
    return { server, id };
  }

  let rawSchema: string;
  try { rawSchema = await fetchSchema(params.schemaURL, !!opts.allowFile); } catch (e: any) {
    adapter.addTool({ name: id + '_error', description: 'Schema download error', handler: async () => ({ content: [{ type: 'text', text: e.message }] }) });
    return { server, id };
  }
  let parsed: any;
  try { parsed = await loadAndParseOpenAPI(rawSchema); } catch (e:any) {
    adapter.addTool({ name: id + '_error', description: 'Schema parse error', handler: async () => ({ content: [{ type: 'text', text: e.message }] }) });
    return { server, id };
  }

  registerAuthTools(adapter as any, id, parsed);
  (adapter as any)._securitySchemes = parsed.securitySchemes || {};

  // Filter endpoints if needed (reuse existing filter infra if present)
  let endpoints = parsed.endpoints;
  if (params.filters.length) {
    const { parseFilterDSL, shouldInclude } = await import('../filters/dsl.js');
    const filterObjs = params.filters.flatMap(parseFilterDSL);
    endpoints = endpoints.filter((ep: any) => shouldInclude(ep.path, ep.method, filterObjs));
  }

  // Reuse existing registerEndpoints by letting it call adapter.addTool
  // Wrap rate limiting: monkey-patch adapter.addTool temporarily to add RL logic similar to legacy generation (basic per-tool window limit)
  const origAdd = adapter.addTool.bind(adapter);
  (adapter as any).addTool = (tool: any) => {
    const limit = (params as any).defaultRateLimitPerMinute || 120;
    const windowMs = 60_000;
    let windowStart = Date.now();
    let count = 0;
    const userHandler = tool.handler;
    tool.handler = async (call: any) => {
      const now = Date.now();
      if (now - windowStart >= windowMs) { windowStart = now; count = 0; }
      if (count >= limit) {
        return { content: [{ type: 'text', text: `Rate limit exceeded (${limit}/min)` }], isError: true };
      }
      count++;
      return userHandler(call);
    };
    origAdd(tool);
  };

  registerEndpoints(adapter as any, id, { ...parsed, endpoints }, params as any, debug, () => true);

  // Populate basic resources & prompts
  try {
    // Fallback in-memory resource & prompt registration using adapter until SDK exposes registerResource/registerPrompt
    (adapter as any).registerResource({ name: 'openapi_schema', description: 'Original OpenAPI document', mimeType: 'application/json', get: () => rawSchema });
    (adapter as any).registerResource({ name: 'endpoint_index', description: 'List of endpoints', mimeType: 'application/json', get: () => JSON.stringify(endpoints.map((e:any)=>({ method:e.method, path:e.path, operationId:e.operationId })), null, 2) });
    // Dynamic endpoint detail resource emulation: oas_endpoint_<METHOD>_<sanitized_path>
    for (const ep of endpoints) {
      const epName = 'endpoint_' + String(ep.method || '').toLowerCase() + '_' + String(ep.path || '').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
      if (!(adapter as any).getResource(epName)) {
        (adapter as any).registerResource({ name: epName, description: `Details for ${ep.method} ${ep.path}`, mimeType: 'application/json', get: () => JSON.stringify({ summary: ep.summary || ep.operationId, description: ep.description, operationId: ep.operationId, method: ep.method, path: ep.path }, null, 2) });
      }
    }
    (adapter as any).registerPrompt({ name: 'endpoint_help', description: 'Info about an endpoint', args: { path: 'string', method: 'string' }, run: ({ path, method }: any) => {
      const ep = endpoints.find((e:any)=> e.path === path && e.method.toUpperCase() === String(method||'').toUpperCase());
      if (!ep) return { error: 'Not found' };
      return { summary: ep.summary || ep.operationId, description: ep.description, operationId: ep.operationId, method: ep.method, path: ep.path };
    } });
  } catch { /* ignore */ }

  adapter.addTool({ name: id + '_diag', description: 'Diagnostics', handler: async () => ({ content: [{ type: 'text', text: JSON.stringify({ endpointCount: endpoints.length, baseURL: params.baseURL, schemaURL: params.schemaURL }, null, 2) }] }) });
  adapter.addTool({ name: id + '_metrics', description: 'Return metrics', handler: async () => ({ content: [{ type: 'text', text: JSON.stringify(adapter.getMetrics(), null, 2) }] }) });
  // Credential management tools
  adapter.addTool({ name: id + '_auth_list', description: 'List credentials', handler: async () => ({ content: [{ type: 'text', text: JSON.stringify((adapter as any).listCredentialsMasked(), null, 2) }] }) });
  adapter.addTool({ name: id + '_auth_set_token', description: 'Set bearer token', handler: async (call: any) => { const t = call?.arguments?.token; if (!t) return { content:[{ type:'text', text:'token required'}], isError:true }; await (adapter as any).setCredential('auth', { token: t }); return { content:[{ type:'text', text:'ok'}] }; } });
  adapter.addTool({ name: id + '_auth_clear_token', description: 'Clear bearer token', handler: async () => { await (adapter as any).clearCredential('auth'); return { content:[{ type:'text', text:'cleared'}] }; } });
  adapter.addTool({ name: id + '_auth_refresh_token', description: 'Refresh OAuth tokens', handler: async () => { const creds = (adapter as any).getAllCredentials(); for (const schemeName of Object.keys(creds)) { await (adapter as any).refreshOAuthTokenIfNeeded(schemeName, fetch); } return { content:[{ type:'text', text:'refreshed'}] }; } });

  // Retry policy management tools
  adapter.addTool({ name: id + '_get_retry_policy', description: 'Get default retry policy', handler: async () => ({ content:[{ type:'text', text: JSON.stringify((server as any).__defaultRetryPolicy || {}, null, 2) }] }) });
  adapter.addTool({ name: id + '_set_retry_policy', description: 'Set default retry policy', input: { type:'object', properties: { maxRetries:{type:'integer'}, baseDelayMs:{type:'integer'}, factor:{type:'number'}, jitterPct:{type:'number'}, retryOnMethods:{ type:'array', items:{ type:'string'} }, retryOnStatuses:{ type:'array', items:{ type:'integer'} } }, required: [] }, handler: async (call:any) => { const rp = call?.arguments || {}; (server as any).__defaultRetryPolicy = { ...(server as any).__defaultRetryPolicy, ...rp }; return { content:[{ type:'text', text:'updated'}] }; } });
  // Tool enable/disable management
  adapter.addTool({ name: id + '_list_tools', description: 'List tools & enabled state', handler: async () => ({ content:[{ type:'text', text: JSON.stringify((adapter as any).listRegisteredTools(), null, 2) }] }) });
  adapter.addTool({ name: id + '_enable_tool', description: 'Enable a tool', input: { type:'object', properties:{ name:{ type:'string'} }, required:['name'] }, handler: async (call:any) => { const n = call?.arguments?.name; (adapter as any).enableTool(n); return { content:[{ type:'text', text:'enabled '+n}] }; } });
  adapter.addTool({ name: id + '_disable_tool', description: 'Disable a tool', input: { type:'object', properties:{ name:{ type:'string'} }, required:['name'] }, handler: async (call:any) => { const n = call?.arguments?.name; (adapter as any).disableTool(n); return { content:[{ type:'text', text:'disabled '+n}] }; } });
  adapter.addTool({ name: id + '_remove_tool', description: 'Remove a tool', input: { type:'object', properties:{ name:{ type:'string'} }, required:['name'] }, handler: async (call:any) => { const n = call?.arguments?.name; (adapter as any).removeTool(n); return { content:[{ type:'text', text:'removed '+n}] }; } });
  adapter.addTool({ name: id + '_list_resources', description: 'List registered resources', handler: async () => ({ content:[{ type:'text', text: JSON.stringify((adapter as any).listResources(), null, 2) }] }) });
  adapter.addTool({ name: id + '_get_resource', description: 'Get resource content', input: { type:'object', properties:{ name:{ type:'string'} }, required:['name'] }, handler: async (call:any) => { const n = call?.arguments?.name; const r = (adapter as any).getResource(n); if (!r) return { content:[{ type:'text', text:'Not found'}], isError:true }; const text = await r.get(); return { content:[{ type:'text', text: typeof text === 'string'? text: text }] }; } });
  adapter.addTool({ name: id + '_list_prompts', description: 'List registered prompts', handler: async () => ({ content:[{ type:'text', text: JSON.stringify((adapter as any).listPrompts(), null, 2) }] }) });
  adapter.addTool({ name: id + '_run_prompt', description: 'Run a prompt', input: { type:'object', properties:{ name:{ type:'string'}, args:{ type:'object'} }, required:['name'] }, handler: async (call:any) => { const n=call?.arguments?.name; const args=call?.arguments?.args||{}; const out=(adapter as any).runPrompt(n,args); return { content:[{ type:'text', text: JSON.stringify(await out, null,2)}] }; } });
  adapter.addTool({ name: id + '_complete', description: 'Complete argument values', input: { type:'object', properties:{ kind:{ type:'string'}, prefix:{ type:'string'}, path:{ type:'string'}, discriminatorProp:{ type:'string'} }, required:['kind'] }, handler: async (call:any) => {
    const { kind, prefix='', path, discriminatorProp } = call?.arguments || {};
    let list: string[] = [];
    if (kind === 'path') list = Array.from(new Set((endpoints as any[]).map((e:any)=> String(e.path||''))));
    else if (kind === 'method' && path) list = Array.from(new Set((endpoints as any[]).filter((e:any)=> e.path===path).map((e:any)=> String(e.method||'').toUpperCase())));
    else if (kind === 'discriminator' && discriminatorProp) {
      for (const ep of endpoints as any[]) {
        const rb: any = ep.requestBody;
        const firstCT: any = rb?.content ? Object.values(rb.content as any)[0] : undefined;
        const schema: any = firstCT?.schema;
        const disc = schema?.discriminator;
        if (disc && disc.propertyName === discriminatorProp) {
          const mapping = disc.mapping ? Object.keys(disc.mapping) : [];
          list.push(...mapping.map(String));
        }
      }
    }
    const out = list.filter(v=> v.toLowerCase().startsWith(String(prefix).toLowerCase())).slice(0,50);
    return { content:[{ type:'text', text: JSON.stringify(out, null, 2) }] };
  } });
  adapter.addTool({ name: id + '_summarize_json', description: 'Summarize JSON (sampling if model available)', input: { type:'object', properties:{ json:{ type:'string'}, maxTokens:{type:'integer'}, temperature:{type:'number'}, stop:{ type:'array', items:{ type:'string'} } }, required:['json'] }, handler: async (call:any) => { const text = call?.arguments?.json; if (!text) return { content:[{ type:'text', text:'json required'}], isError:true }; const maxTokens = call?.arguments?.maxTokens || 256; const temperature = call?.arguments?.temperature; const stop = call?.arguments?.stop; const sampling = (server as any).server?.createMessage; try { if (sampling) { const resp = await (server as any).server.createMessage({ messages:[{ role:'user', content:{ type:'text', text:`Summarize this JSON structure succinctly focusing on key entities and counts:\n${text}` } }], maxTokens, temperature, stop }); const summary = resp?.content?.type === 'text' ? resp.content.text : JSON.stringify(resp?.content); return { content:[{ type:'text', text: summary }] }; } } catch(e:any) { /* fallback below */ } let parsedLocal:any; try { parsedLocal = JSON.parse(text); } catch { return { content:[{ type:'text', text:'Invalid JSON'}], isError:true }; } const keys = typeof parsedLocal==='object' && parsedLocal ? Object.keys(parsedLocal).slice(0,30) : []; const preview = JSON.stringify(parsedLocal, null, 2); const truncated = preview.length > 800 ? preview.slice(0,800)+'…' : preview; return { content:[{ type:'text', text:`Keys(${keys.length}): ${keys.join(', ')}\nPreview:\n${truncated}` }] }; } });
  // Sampling helper tool for generic prompts
  adapter.addTool({ name: id + '_sample', description: 'Invoke model sampling (if supported) with custom prompt', input: { type:'object', properties:{ prompt:{ type:'string'}, maxTokens:{ type:'integer'}, temperature:{ type:'number'}, stop:{ type:'array', items:{ type:'string'} }, retries:{ type:'integer'}, backoffMs:{ type:'integer'} }, required:['prompt'] }, handler: async (call:any) => { const sampling = (server as any).server?.createMessage; if (!sampling) return { content:[{ type:'text', text:'Sampling not supported by client'}], isError:true }; const prompt = call?.arguments?.prompt; const maxTokens = call?.arguments?.maxTokens || 256; const temperature = call?.arguments?.temperature; const stop = call?.arguments?.stop; const retries = Math.min(call?.arguments?.retries || 1, 5); const backoffMs = Math.min(call?.arguments?.backoffMs || 500, 5000); let attempt=0; let lastErr:any; while (attempt < retries) { attempt++; try { const resp = await (server as any).server.createMessage({ messages:[{ role:'user', content:{ type:'text', text: prompt } }], maxTokens, temperature, stop }); const txt = resp?.content?.type==='text'? resp.content.text : JSON.stringify(resp?.content); return { content:[{ type:'text', text: txt }] }; } catch(e:any) { lastErr = e; if (attempt < retries) await new Promise(r=> setTimeout(r, backoffMs * attempt)); } } return { content:[{ type:'text', text:`Sampling failed: ${lastErr?.message||'unknown'}` }], isError:true }; } });
  // Completion helper for endpoint resources
  adapter.addTool({ name: id + '_complete_endpoint', description: 'Complete endpoint path or method', input: { type:'object', properties:{ kind:{ type:'string'}, value:{ type:'string'}, path:{ type:'string'} }, required:['kind'] }, handler: async (call:any) => { const { kind, value='', path } = call?.arguments||{}; if (kind==='path') { const pathSet = Array.from(new Set(endpoints.map((e:any)=> String(e.path||'')))); const paths: string[] = (pathSet as string[]).filter(p => p.startsWith(String(value))); return { content:[{ type:'text', text: JSON.stringify(paths.slice(0,50), null,2)}] }; } if (kind==='method') { const methodSet = Array.from(new Set(endpoints.filter((e:any)=> !path|| e.path===path).map((e:any)=> String(e.method||'').toUpperCase()))); const methods: string[] = (methodSet as string[]).filter(m => m.startsWith(String(value).toUpperCase())); return { content:[{ type:'text', text: JSON.stringify(methods.slice(0,25), null,2)}] }; } return { content:[{ type:'text', text:'[]'}] }; } });
  adapter.addTool({ name: id + '_interactive_echo', description: 'Echo text after confirmation', input: { type:'object', properties:{ text:{ type:'string'} }, required:['text'] }, handler: async (call:any) => { const val = call?.arguments?.text; if (!val) return { content:[{ type:'text', text:'text required'}], isError:true }; try { if ((server as any).server?.elicitInput) { const res = await (server as any).server.elicitInput({ message:`Echo "${val}"?`, requestedSchema:{ type:'object', properties:{ proceed:{ type:'boolean'} }, required:['proceed'] } }); if (res.action==='accept' && (res as any).content?.proceed) return { content:[{ type:'text', text: val }] }; return { content:[{ type:'text', text:'Cancelled'}] }; } } catch {} return { content:[{ type:'text', text: val }] }; } });

  adapter.addTool({ name: id + '_import_env_credentials', description: 'Import environment credentials (prefix OAS_MCP_)', handler: async () => {
    const prefix = 'OAS_MCP_';
    const schemes: Record<string, any> = (adapter as any)._securitySchemes || {};
    const imported: string[] = [];
    for (const [name, def] of Object.entries<any>(schemes)) {
      if (def.type === 'http' && def.scheme === 'basic') {
        const u = process.env[prefix + name.toUpperCase() + '_USERNAME'];
        const p = process.env[prefix + name.toUpperCase() + '_PASSWORD'];
        if (u && p) { await (adapter as any).setCredential(name, { username: u, password: p }); imported.push(name); }
      } else if (def.type === 'http' && def.scheme === 'bearer') {
        const t = process.env[prefix + name.toUpperCase() + '_TOKEN'];
        if (t) { await (adapter as any).setCredential(name, { token: t }); imported.push(name); }
      } else if (def.type === 'apiKey') {
        const v = process.env[prefix + name.toUpperCase() + '_VALUE'] || process.env[prefix + name.toUpperCase() + '_TOKEN'];
        if (v) { await (adapter as any).setCredential(name, { value: v }); imported.push(name); }
      } else if (def.type === 'oauth2') {
        const at = process.env[prefix + name.toUpperCase() + '_ACCESS_TOKEN'];
        if (at) { await (adapter as any).setCredential(name, { accessToken: at }); imported.push(name); }
      }
    }
    return { content:[{ type:'text', text: JSON.stringify({ imported }) }] };
  } });

  return { server, id };
}
