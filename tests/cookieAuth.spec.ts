import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Cookie Auth API', version: '1.0.0' },
  components: { securitySchemes: {
    CookieA: { type: 'apiKey', in: 'cookie', name: 'sess_a' },
    CookieB: { type: 'apiKey', in: 'cookie', name: 'sess_b' }
  }},
  paths: {
    '/both': { get: { security: [ { CookieA: [], CookieB: [] } ] } }
  }
};

const params: any = { baseURL: 'https://cookie.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('Cookie Auth', () => {
  it('merges multiple cookies and masks values', async () => {
    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      const cookie = init?.headers?.Cookie || init?.headers?.cookie || (init?.headers instanceof Headers ? init.headers.get('Cookie') : undefined);
      return { ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: async () => JSON.stringify({ cookie }), arrayBuffer: async () => new ArrayBuffer(0) } as any;
    });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tools = server.listTools();
    const setA = tools.find(t => t.name.includes('cookiea_set'))!.name;
    const setB = tools.find(t => t.name.includes('cookieb_set'))!.name;
    const callTool = tools.find(t => t.name.includes('get_both'))!.name;
    const listCreds = tools.find(t => t.name.includes('_auth_list_credentials'))!.name;

    await server.callTool(setA, { arguments: { value: 'AAA' } });
    await server.callTool(setB, { arguments: { value: 'BBB' } });
    const resp: any = await server.callTool(callTool, { arguments: {} });
    expect(resp.status).toBe(200);

    const call = fetchSpy.mock.calls[0];
    const cookieHeader = call[1].headers['Cookie'] || call[1].headers.get?.('Cookie');
    expect(cookieHeader).toMatch(/sess_a=AAA/);
    expect(cookieHeader).toMatch(/sess_b=BBB/);

    const list: any = await server.callTool(listCreds, { arguments: {} });
    expect(list.credentials.CookieA.value).not.toBe('AAA');
    expect(list.credentials.CookieB.value).not.toBe('BBB');
  });
});
