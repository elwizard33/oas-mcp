// migrated from test/retryPolicy.spec.ts
import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

// Minimal fake spec with one GET endpoint
const spec = {
  openapi: '3.0.0',
  info: { title: 'Retry Test', version: '1.0.0' },
  paths: { '/ping': { get: { operationId: 'ping', responses: { '200': { description: 'ok' } } } } }
};

describe('Retry Policy', () => {
  it('defaults to 0 retries for non-GET when override not provided', async () => {
    const localSpec = { ...spec, paths: { '/ping': { post: { operationId: 'ping', responses: { '500': { description: 'fail' } } } } } };
    const schema = 'data:application/json,' + encodeURIComponent(JSON.stringify(localSpec));
    const params: any = { schemaURL: schema, baseURL: 'https://example.com', headers: {}, filters: [], nameCollisionMode: 'suffix' };
    let calls = 0;
    const fetchImpl = async () => { calls++; return { ok: false, status: 500, headers: new Headers(), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) } as any; };
    const orig = global.fetch; (global as any).fetch = fetchImpl;
    try {
      const server = await createMcpServer(params, { debug: false });
      const toolName = server.listTools().find(t => /_post_/.test(t.name) && t.name.includes('ping'))!.name;
      const result: any = await server.callTool(toolName, {});
      expect(result.status).toBe(500);
      expect(calls).toBe(1); // no retries
    } finally { (global as any).fetch = orig; }
  });

  it('retries according to custom retryPolicy', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls++;
      if (calls < 3) return { ok: false, status: 503, headers: new Headers(), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) } as any;
      return { ok: true, status: 200, headers: new Headers(), text: async () => 'ok', arrayBuffer: async () => new ArrayBuffer(0) } as any;
    };
    const orig = global.fetch; (global as any).fetch = fetchImpl;
    try {
      const schema = 'data:application/json,' + encodeURIComponent(JSON.stringify(spec));
      const params: any = { schemaURL: schema, baseURL: 'https://example.com', headers: {}, filters: [], nameCollisionMode: 'suffix' };
      const server = await createMcpServer(params, { debug: false });
      const toolName = server.listTools().find(t => /_get_/.test(t.name) && t.name.includes('ping'))!.name;
      const res: any = await server.callTool(toolName, { retryPolicy: { maxRetries: 5, baseDelayMs: 1, factor: 1, jitterPct: 0, retryOnStatuses: [503] } });
      expect(res.status).toBe(200);
      expect(res.retryAttempts).toBe(2);
      expect(calls).toBe(3);
    } finally { (global as any).fetch = orig; }
  });

  it('does not retry statuses not in retryOnStatuses', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls++; return { ok: false, status: 501, headers: new Headers(), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) } as any; };
    const orig = global.fetch; (global as any).fetch = fetchImpl;
    try {
      const schema = 'data:application/json,' + encodeURIComponent(JSON.stringify(spec));
      const params: any = { schemaURL: schema, baseURL: 'https://example.com', headers: {}, filters: [], nameCollisionMode: 'suffix' };
      const server = await createMcpServer(params, { debug: false });
      const toolName = server.listTools().find(t => /_get_/.test(t.name) && t.name.includes('ping'))!.name;
      const res: any = await server.callTool(toolName, { retryPolicy: { maxRetries: 3, baseDelayMs: 1, factor: 1, jitterPct: 0, retryOnStatuses: [503] } });
      expect(res.status).toBe(501);
      expect(res.retryAttempts).toBeUndefined();
      expect(calls).toBe(1);
    } finally { (global as any).fetch = orig; }
  });
});
