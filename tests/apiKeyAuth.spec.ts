import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'API Key Auth', version: '1.0.0' },
  components: { securitySchemes: {
    ApiHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    ApiQuery: { type: 'apiKey', in: 'query', name: 'api_key' },
    ApiCookie: { type: 'apiKey', in: 'cookie', name: 'session_api' }
  }},
  paths: {
    '/header': { get: { security: [ { ApiHeader: [] } ] } },
    '/query': { get: { security: [ { ApiQuery: [] } ] } },
    '/cookie': { get: { security: [ { ApiCookie: [] } ] } }
  }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('API Key Auth injection', () => {
  it('injects header, query, and cookie apiKeys correctly and masks listing', async () => {
    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      if (url.startsWith('https://api.example.com')) {
        const headers = init?.headers || {};
        const authHeader = headers['X-API-Key'] || (init?.headers instanceof Headers ? init.headers.get('X-API-Key') : undefined);
        const cookie = headers['Cookie'] || (init?.headers instanceof Headers ? init.headers.get('Cookie') : undefined);
        return { ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: async () => JSON.stringify({ url, authHeader, cookie }), arrayBuffer: async () => new ArrayBuffer(0) } as any;
      }
      throw new Error('Unexpected URL '+url);
    });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tools = server.listTools();
    const headerSet = tools.find(t => t.name.includes('apiheader_set'))!.name;
    const querySet = tools.find(t => t.name.includes('apiquery_set'))!.name;
    const cookieSet = tools.find(t => t.name.includes('apicookie_set'))!.name;
    const headerTool = tools.find(t => t.name.includes('get_header'))!.name;
    const queryTool = tools.find(t => t.name.includes('get_query'))!.name;
    const cookieTool = tools.find(t => t.name.includes('get_cookie'))!.name;
    const listCreds = tools.find(t => t.name.includes('_auth_list_credentials'))!.name;

    await server.callTool(headerSet, { arguments: { value: 'HEADKEY123' } });
    await server.callTool(querySet, { arguments: { value: 'QKEY456' } });
    await server.callTool(cookieSet, { arguments: { value: 'COOK789' } });

    const headerResp: any = await server.callTool(headerTool, { arguments: {} });
    const queryResp: any = await server.callTool(queryTool, { arguments: {} });
    const cookieResp: any = await server.callTool(cookieTool, { arguments: {} });

    expect(headerResp.status).toBe(200);
    expect(queryResp.status).toBe(200);
    expect(cookieResp.status).toBe(200);

    const calledHeader = fetchSpy.mock.calls.find(c => c[0].includes('/header'))!;
    const calledQuery = fetchSpy.mock.calls.find(c => c[0].includes('/query'))!;
    const calledCookie = fetchSpy.mock.calls.find(c => c[0].includes('/cookie'))!;

    // Header injection
    expect(calledHeader[1].headers['X-API-Key'] || calledHeader[1].headers.get?.('X-API-Key')).toBe('HEADKEY123');
    // Query injection (check URL contains api_key)
    expect(String(calledQuery[0])).toMatch(/api_key=QKEY456/);
    // Cookie injection
    const cookieHeader = calledCookie[1].headers['Cookie'] || calledCookie[1].headers.get?.('Cookie');
    expect(cookieHeader).toMatch(/session_api=COOK789/);

    const list: any = await server.callTool(listCreds, { arguments: {} });
    expect(list.credentials.ApiHeader.value).not.toContain('HEADKEY123');
    expect(list.credentials.ApiHeader.value).toMatch(/\*\*\*/);
  });
});
