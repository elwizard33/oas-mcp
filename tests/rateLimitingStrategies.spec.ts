// migrated from test/rateLimitingStrategies.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

// Simple mock fetch returning 200 quickly
const okFetch = async (url: any, opts: any) => {
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
};

describe('Rate Limiting Strategies', () => {
  const baseParams = (strategy: 'fixed' | 'token-bucket') => ({
    schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify({
      openapi: '3.0.0', info: { title: 't', version: '1' }, paths: {
        '/ping': { get: { operationId: 'ping', responses: { '200': { description: 'ok' } } } }
      }
    })),
    baseURL: 'https://example.com',
    headers: {},
    filters: [],
    rateLimitStrategy: strategy
  });

  beforeEach(() => {
    // @ts-ignore
    global.fetch = vi.fn(okFetch);
  });

  it('fixed window enforces per-minute ceiling', async () => {
    const params = baseParams('fixed');
    const server = await createMcpServer(params as any, { debug: false });
    const tool = server.listTools().find(t => t.name.includes('get_ping'))!;
    // Use small limit
    for (let i=0;i<3;i++) {
      const r: any = await server.callTool(tool.name, { rateLimitPerMinute: 3 });
      expect(r.error).toBeFalsy();
    }
    const r4: any = await server.callTool(tool.name, { rateLimitPerMinute: 3 });
    expect(r4.error?.type).toBe('rate_limit');
  });

  it('token bucket allows bursts up to capacity then blocks', async () => {
    const params = baseParams('token-bucket');
    const server = await createMcpServer(params as any, { debug: false });
    const tool = server.listTools().find(t => t.name.includes('get_ping'))!;
    // capacity 3
    for (let i=0;i<3;i++) {
      const r: any = await server.callTool(tool.name, { rateLimitPerMinute: 3 });
      expect(r.error).toBeFalsy();
    }
    const rBlocked: any = await server.callTool(tool.name, { rateLimitPerMinute: 3 });
    expect(rBlocked.error?.type).toBe('rate_limit');
  });
});
