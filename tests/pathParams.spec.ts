import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

// Minimal parsed params shape
const baseParams: any = {
  baseURL: 'https://api.example.com',
  schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths: {
      '/widgets/{id}': {
        get: { summary: 'Get widget', parameters: [ { name: 'id', in: 'path', required: true, schema: { type: 'string' } } ] }
      }
    }
  })),
  filters: []
};

// Mock global fetch
const originalFetch = global.fetch;

describe('Path parameter validation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns input error when required path param missing', async () => {
    const fetchSpy = vi.fn();
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(baseParams, { debug: false, allowFile: false });
    const tools = server.listTools();
  const tool = tools.find(t => t.name.toLowerCase().includes('get_widgets')); // sanitized name pattern
    expect(tool).toBeTruthy();
    const result: any = await server.callTool(tool!.name, { arguments: { pathNames: {} } });
    expect(result.error).toBeTruthy();
    expect(result.error.type).toBe('input');
    expect(String(result.error.message)).toMatch(/Missing required path parameter/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('performs fetch when required path param provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      text: () => Promise.resolve('{}'),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
    });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(baseParams, { debug: false, allowFile: false });
  const tool = server.listTools().find(t => t.name.toLowerCase().includes('get_widgets'))!;
    const result: any = await server.callTool(tool.name, { arguments: { pathNames: { id: '123' } } });
    expect(result.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toContain('/widgets/123');
  });

  afterAll(() => {
    // @ts-ignore
    global.fetch = originalFetch;
  });
});
