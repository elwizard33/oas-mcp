// migrated from test/sharedTypes.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';
import { parseRequestParams } from '../src/util/params.js';
import type { HttpResponseEnvelope } from '../src/types/shared.js';

const sampleSpec = { openapi: '3.0.0', info: { title: 'Shared Types Test', version: '1.0.0' }, paths: { '/ping': { get: { summary: 'Ping', operationId: 'pingOp' } } } };

describe('Shared type response envelope', () => {
  it('returns an HttpResponseEnvelope shape from a tool call', async () => {
    // Mock fetch to avoid network dependency
    const fakeResp = (body: any, status = 200, headers: Record<string,string> = { 'content-type': 'application/json' }) => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()], entries: () => Object.entries(headers) } as any,
      text: async () => typeof body === 'string' ? body : JSON.stringify(body),
      json: async () => typeof body === 'string' ? JSON.parse(body) : body,
    });
    // @ts-ignore override global
    global.fetch = vi.fn(async () => fakeResp({ pong: true }));
    const schemaDataUrl = 'data:application/json,' + encodeURIComponent(JSON.stringify(sampleSpec));
    const params = await parseRequestParams({ s: schemaDataUrl, u: 'https://example.com' });
    const server = await createMcpServer(params, { debug: false });
  const tools = server.listTools();
  const tool = tools.find(t => t.name.endsWith('_get_ping'));
    expect(tool).toBeTruthy();
    if (!tool) return;
    const result = await server.callTool(tool.name, {});
    const env: HttpResponseEnvelope = result;
    expect(typeof env.status).toBe('number');
    expect(env).toHaveProperty('ok');
    expect(env).toHaveProperty('headers');
    expect(env).toHaveProperty('elapsedMs');
  });
});
