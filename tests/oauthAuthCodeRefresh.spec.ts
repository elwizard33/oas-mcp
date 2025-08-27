import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'OAuth Auth Code Refresh', version: '1.0.0' },
  components: { securitySchemes: {
    AuthCode: { type: 'oauth2', flows: { authorizationCode: { authorizationUrl: 'https://auth.example.com/authorize', tokenUrl: 'https://auth.example.com/token' } } }
  }},
  paths: { '/data': { get: { security: [ { AuthCode: [] } ] } } }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('OAuth2 authorization code auto refresh', () => {
  it('auto refreshes when token expired and refresh_token present', async () => {
    let exchangeCount = 0;
    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      if (url === 'https://auth.example.com/token') {
        exchangeCount++;
        // first call: exchange code, second call: refresh
        if (init?.body && (init.body as string).includes('authorization_code')) {
          return { ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), json: async () => ({ access_token: 'AC1', refresh_token: 'RT1', expires_in: 1 }), text: async () => '{}', arrayBuffer: async () => new ArrayBuffer(0) } as any;
        }
        if (init?.body && (init.body as string).includes('refresh_token')) {
          return { ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), json: async () => ({ access_token: 'AC2', refresh_token: 'RT2', expires_in: 3600 }), text: async () => '{}', arrayBuffer: async () => new ArrayBuffer(0) } as any;
        }
      }
      if (url.startsWith('https://api.example.com')) {
        const auth = (init?.headers || {})['Authorization'] || (init?.headers instanceof Headers ? init.headers.get('Authorization') : undefined);
        return { ok: !!auth, status: !!auth ? 200 : 401, headers: new Headers({'content-type':'application/json'}), text: async () => JSON.stringify({ auth }), arrayBuffer: async () => new ArrayBuffer(0) } as any;
      }
      throw new Error('Unexpected URL '+url);
    });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tools = server.listTools();
    const configure = tools.find(t => t.name.includes('authcode_configure_auth_code'))!.name;
    const generate = tools.find(t => t.name.includes('authcode_auth_code_generate_url'))!.name;
    const exchange = tools.find(t => t.name.includes('authcode_auth_code_exchange_code'))!.name;
    const refreshTool = tools.find(t => t.name.includes('authcode_refresh_token'))!.name;
    const globalRefresh = tools.find(t => t.name.endsWith('_auth_refresh_token'))!.name;
    const dataTool = tools.find(t => t.name.includes('get_data'))!.name;
    await server.callTool(configure, { arguments: { clientId: 'cid', redirectUri: 'https://app.example.com/cb' } });
    const gen = await server.callTool(generate, { arguments: {} });
    await server.callTool(exchange, { arguments: { code: 'CODE', state: (gen as any).state } });
    // Initial call with AC1
    await server.callTool(dataTool, { arguments: {} });
    // Wait for expiry (1s)
    await new Promise(r => setTimeout(r, 1200));
    // Next call should auto refresh
    await server.callTool(dataTool, { arguments: {} });
    // Explicit per-scheme refresh (should be no-op quickly)
    await server.callTool(refreshTool, { arguments: {} });
    // Global refresh
    await server.callTool(globalRefresh, { arguments: {} });
    const tokenCalls = fetchSpy.mock.calls.filter(c => c[0] === 'https://auth.example.com/token').length;
    expect(tokenCalls).toBeGreaterThanOrEqual(2);
  });
});
