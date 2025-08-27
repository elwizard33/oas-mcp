import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'OAuth Auth Code', version: '1.0.0' },
  components: { securitySchemes: {
    AuthCode: { type: 'oauth2', flows: { authorizationCode: { authorizationUrl: 'https://auth.example.com/authorize', tokenUrl: 'https://auth.example.com/token' } } }
  }},
  paths: { '/secure': { get: { security: [ { AuthCode: [] } ] } } }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('OAuth2 authorization code flow tools', () => {
  it('configures, generates URL, exchanges code, and injects token', async () => {
    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      if (url === 'https://auth.example.com/token') {
        return {
          ok: true,
          status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ access_token: 'AC_TOKEN', refresh_token: 'RF_TOKEN', expires_in: 3600 }),
          text: async () => '{}',
          arrayBuffer: async () => new ArrayBuffer(0)
        } as any;
      }
      if (url.startsWith('https://api.example.com')) {
        const auth = (init?.headers || {})['Authorization'] || (init?.headers instanceof Headers ? init.headers.get('Authorization') : undefined);
        return { ok: !!auth, status: !!auth ? 200 : 401, headers: new Headers({ 'content-type': 'application/json' }), text: async () => JSON.stringify({ auth }), arrayBuffer: async () => new ArrayBuffer(0) } as any;
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
    const secure = tools.find(t => t.name.includes('get_secure'))!.name;
    await server.callTool(configure, { arguments: { clientId: 'cid', redirectUri: 'https://app.example.com/cb', scope: 'openid offline' } });
    const genResp: any = await server.callTool(generate, { arguments: {} });
    expect(genResp.authorization_url).toMatch(/code_challenge=/);
    // Simulate user completed auth and we received 'CODE123'
    const exchResp: any = await server.callTool(exchange, { arguments: { code: 'CODE123', state: genResp.state } });
    expect(exchResp.access_token).toBe('AC_TOKEN');
    const apiResp: any = await server.callTool(secure, { arguments: {} });
    expect(apiResp.status).toBe(200);
  });
});
