import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Inject', version: '1.0.0' },
  components: { securitySchemes: {
    ApiKeyQuery: { type: 'apiKey', in: 'query', name: 'api_key' },
    ApiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    ApiKeyCookie: { type: 'apiKey', in: 'cookie', name: 'session' },
    BasicAuth: { type: 'http', scheme: 'basic' },
    BearerAuth: { type: 'http', scheme: 'bearer' }
  }},
  paths: {
    '/q': { get: { security: [ { ApiKeyQuery: [] } ] } },
    '/h': { get: { security: [ { ApiKeyHeader: [] } ] } },
    '/c': { get: { security: [ { ApiKeyCookie: [] } ] } },
    '/b': { get: { security: [ { BasicAuth: [] } ] } },
    '/bear': { get: { security: [ { BearerAuth: [] } ] } },
    '/or': { get: { security: [ { ApiKeyHeader: [] }, { BearerAuth: [] } ] } }
  }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

function mockFetchCapture() {
  const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: () => Promise.resolve('{}'), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
  // @ts-ignore
  global.fetch = fetchSpy;
  return fetchSpy;
}

describe('Automatic credential injection', () => {
  it('injects apiKey in query, header, cookie; basic, bearer; selects first satisfied OR', async () => {
    const fetchSpy = mockFetchCapture();
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tools = server.listTools();
    const find = (p: string) => tools.find(t => t.name.includes(p))!.name;
    // set credentials
    await server.callTool(find('auth_apikeyquery_set'), { arguments: { value: 'QKEY' } });
    await server.callTool(find('auth_apikeyheader_set'), { arguments: { value: 'HKEY' } });
    await server.callTool(find('auth_apikeycookie_set'), { arguments: { value: 'CKEY' } });
    await server.callTool(find('auth_basicauth_set'), { arguments: { username: 'user', password: 'pass' } });
    await server.callTool(find('auth_bearerauth_set'), { arguments: { token: 'BTOKEN' } });

    // Call each endpoint
    await server.callTool(find('get_q'), { arguments: {} });
    let calledUrl = fetchSpy.mock.calls.pop()[0];
    expect(calledUrl).toMatch(/api_key=QKEY/);

    await server.callTool(find('get_h'), { arguments: {} });
    let hdrs = fetchSpy.mock.calls.pop()[1].headers;
    expect(hdrs['X-API-Key']).toBe('HKEY');

    await server.callTool(find('get_c'), { arguments: {} });
    hdrs = fetchSpy.mock.calls.pop()[1].headers;
    expect(hdrs['Cookie']).toMatch(/session=CKEY/);

    await server.callTool(find('get_b'), { arguments: {} });
    hdrs = fetchSpy.mock.calls.pop()[1].headers;
    expect(hdrs['Authorization']).toMatch(/^Basic /);

    await server.callTool(find('get_bear'), { arguments: {} });
    hdrs = fetchSpy.mock.calls.pop()[1].headers;
    expect(hdrs['Authorization']).toBe('Bearer BTOKEN');

    // OR selection (ApiKeyHeader first)
    await server.callTool(find('get_or'), { arguments: {} });
    hdrs = fetchSpy.mock.calls.pop()[1].headers;
    expect(hdrs['X-API-Key']).toBe('HKEY');
  });
});
