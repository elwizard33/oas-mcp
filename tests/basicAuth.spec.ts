import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Basic Auth API', version: '1.0.0' },
  components: { securitySchemes: {
    BasicAuth: { type: 'http', scheme: 'basic' }
  }},
  paths: {
    '/ping': { get: { security: [ { BasicAuth: [] } ] } }
  }
};

const params: any = { baseURL: 'https://basic.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('Basic Auth', () => {
  it('injects Authorization header and masks credentials', async () => {
    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      const auth = init?.headers?.Authorization || init?.headers?.authorization || (init?.headers instanceof Headers ? init.headers.get('Authorization') : undefined);
      return { ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: async () => JSON.stringify({ auth }), arrayBuffer: async () => new ArrayBuffer(0) } as any;
    });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tools = server.listTools();
    const setTool = tools.find(t => t.name.includes('basicauth_set'))!.name;
    const callTool = tools.find(t => t.name.includes('get_ping'))!.name;
    const listTool = tools.find(t => t.name.includes('_auth_list_credentials'))!.name;

    await server.callTool(setTool, { arguments: { username: 'user1', password: 'p@ss' } });
    const resp: any = await server.callTool(callTool, { arguments: {} });
    expect(resp.status).toBe(200);

    const call = fetchSpy.mock.calls[0];
    const hdrs = call[1].headers;
    const authHeader = hdrs['Authorization'] || hdrs['authorization'] || hdrs.get?.('Authorization');
    expect(authHeader).toMatch(/^Basic /);
    const b64 = authHeader.split(' ')[1];
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    expect(decoded).toBe('user1:p@ss');

    const list: any = await server.callTool(listTool, { arguments: {} });
    // Adjusted: BasicAuth returns object { username, password }
    expect(list.credentials.BasicAuth.username).toBe('user1');
    expect(list.credentials.BasicAuth.password).not.toBe('p@ss');
    expect(list.credentials.BasicAuth.password).toMatch(/\*\*\*/);
  });
});
