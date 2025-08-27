import type { ParsedSpec } from '../types';

function encodeParams(params: Record<string,string|undefined>) {
  const usp = new URLSearchParams();
  for (const [k,v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    usp.set(k, v);
  }
  return usp.toString();
}

export interface BuildConfigInput {
  schemaURL: string;
  baseURL: string;
  serverName: string;
  // headers intentionally excluded from URL for security; any sensitive auth must be stored via credential endpoint.
  headers?: Record<string,string>;
  packMode?: 'plain' | 'code';
  port?: number;
}

export function buildConfig(_spec: ParsedSpec, opts: BuildConfigInput) {
  const port = opts.port || 8080;
  let query: string;
  // Only include schema + base URL. Never include Authorization or user headers here.
  query = encodeParams({ s: opts.schemaURL, u: opts.baseURL, n: opts.serverName });
  const url = `http://127.0.0.1:${port}/sse?${query}`;
  // Return only the snippet that goes under mcp.json "servers".
  return {
    serverName: opts.serverName,
    snippet: { [opts.serverName]: { url } },
    url
  };
}
