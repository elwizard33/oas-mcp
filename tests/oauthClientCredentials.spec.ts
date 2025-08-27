import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'OAuth CC', version: '1.0.0' },
  components: { securitySchemes: {
    OAuth2CC: { type: 'oauth2', flows: { clientCredentials: { tokenUrl: 'https://auth.example.com/token', scopes: { read: 'Read' } } } }
  }},
  paths: { '/data': { get: { security: [ { OAuth2CC: [] } ] } } }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('OAuth2 client credentials flow tools', () => {
  it('configures, fetches token, injects into call, and refreshes on expiry', async () => {
    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      if (url === 'https://auth.example.com/token') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ access_token: 'AT_'+Math.random().toString(16).slice(2), expires_in: 1 }),
          text: async () => '{}',
          arrayBuffer: async () => new ArrayBuffer(0)
        } as any;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{}',
        arrayBuffer: async () => new ArrayBuffer(0)
      } as any;
    });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tools = server.listTools();
    const configure = tools.find(t => t.name.includes('oauth2cc_configure_client_credentials'))!.name;
    const fetchTokenTool = tools.find(t => t.name.includes('oauth2cc_fetch_client_token'))!.name;
    const dataTool = tools.find(t => t.name.includes('get_data'))!.name;
    await server.callTool(configure, { arguments: { clientId: 'id', clientSecret: 'secret', scope: 'read' } });
    await server.callTool(fetchTokenTool, {});
    await server.callTool(dataTool, { arguments: {} });
    // Should have called token endpoint and data endpoint
    expect(fetchSpy.mock.calls.some(c => c[0] === 'https://auth.example.com/token')).toBe(true);
    // Wait >1s to trigger refresh
    await new Promise(r => setTimeout(r, 1100));
    await server.callTool(dataTool, { arguments: {} });
    const tokenCalls = fetchSpy.mock.calls.filter(c => c[0] === 'https://auth.example.com/token').length;
    expect(tokenCalls).toBeGreaterThanOrEqual(2); // initial + refresh
  });
});
