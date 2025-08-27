import { decodeBase64 } from './base64.js';

export interface RawParams {
  s?: string; // schema URL
  u?: string; // base URL
  h?: string; // headers JSON
  f?: string | string[]; // filter DSL(s)
  code?: string; // base64 encoded aggregate JSON
  a?: string; // comma-separated allowed domains (allowlist)
  n?: string; // server name override
}

export interface ParsedParams {
  schemaURL?: string;
  baseURL?: string;
  headers: Record<string,string>;
  filters: string[]; // raw DSL strings to be parsed later
  rawSchema?: string; // lazy loaded external
  allowedDomains?: string[]; // for SSRF mitigation
  rateLimitStrategy?: 'fixed' | 'token-bucket';
  streamMode?: 'off' | 'chunk';
  streamThreshold?: number;
  nameCollisionMode?: 'suffix' | 'hash';
  credStore?: 'memory' | 'file';
  serverName?: string; // explicit server id override
}

export async function parseRequestParams(raw: RawParams): Promise<ParsedParams> {
  const result: ParsedParams = { headers: {}, filters: [] };
  if (raw.code) {
    try {
      const decoded = JSON.parse(decodeBase64(raw.code));
      if (decoded.s) result.schemaURL = decoded.s;
      if (decoded.u) result.baseURL = decoded.u;
      if (decoded.h) Object.assign(result.headers, decoded.h);
      if (decoded.f) result.filters.push(decoded.f);
      if (decoded.a) result.allowedDomains = String(decoded.a).split(',').map((s:string) => s.trim()).filter(Boolean);
      if (decoded.n) result.serverName = String(decoded.n).trim();
    } catch (e) {
      // ignore for now; upstream handler can validate
    }
  } else {
    if (raw.s) result.schemaURL = raw.s;
    if (raw.u) result.baseURL = raw.u;
    if (raw.n) result.serverName = String(raw.n).trim();
    if (raw.h) {
      try { Object.assign(result.headers, JSON.parse(raw.h)); } catch {/* ignore */}
    }
    if (raw.f) {
      if (Array.isArray(raw.f)) result.filters.push(...raw.f);
      else result.filters.push(raw.f);
    }
    if (raw.a) {
      result.allowedDomains = String(raw.a).split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return result;
}
