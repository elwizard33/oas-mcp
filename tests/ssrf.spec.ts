import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const baseSpec = {
  openapi: '3.0.0',
  info: { title: 'SSRF Test', version: '1.0.0' },
  paths: {
    '/ok': { get: {} }
  }
};

function makeParams(baseURL: string, allowed: string[]) {
  return { baseURL, schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(baseSpec)), filters: [], allowedDomains: allowed } as any;
}

describe('SSRF protections', () => {
  it('allows allowed domain & blocks disallowed', async () => {
    const fetchSpy = vi.fn(async (url: string) => ({ ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: async () => '{}', arrayBuffer: async () => new ArrayBuffer(0) }) as any);
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(makeParams('https://api.good.com', ['good.com']), { debug: false });
    const tool = server.listTools().find(t => t.name.includes('get_ok'))!.name;
    const resp: any = await server.callTool(tool, { arguments: {} });
    expect(resp.status).toBe(200);
  });

  it('blocks baseURL not in allowlist', async () => {
    const server = await createMcpServer(makeParams('https://api.bad.com', ['good.com']), { debug: false });
    const tools = server.listTools();
    expect(tools.find(t => t.name.endsWith('_error'))).toBeTruthy();
  });

  it('blocks private ip host', async () => {
    const server = await createMcpServer(makeParams('http://127.0.0.1', ['127.0.0.1']), { debug: false });
    const tools = server.listTools();
    expect(tools.find(t => t.name.endsWith('_error'))).toBeTruthy();
  });
});
