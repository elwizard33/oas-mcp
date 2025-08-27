import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Query Styles', version: '1.0.0' },
  paths: {
    '/items': {
      get: {
        parameters: [
          { name: 'tags', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: false },
          { name: 'colors', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: true },
          { name: 'spaces', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'spaceDelimited', explode: false },
          { name: 'pipes', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'pipeDelimited', explode: false }
        ]
      }
    }
  }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('Query array styles', () => {
  it('encodes various styles correctly', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: () => Promise.resolve('{}'), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tool = server.listTools().find(t => t.name.includes('get_items'))!;
    await server.callTool(tool.name, { arguments: { searchParams: { tags: ['a','b'], colors: ['red','blue'], spaces: ['x','y'], pipes: ['p','q'] } } });
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    // tags form explode=false => tags=a,b
    expect(calledUrl).toMatch(/tags=a%2Cb/);
    // colors form explode=true => colors=red&colors=blue
    expect(calledUrl).toMatch(/colors=red/);
    expect(calledUrl.match(/colors=/g)?.length).toBe(2);
  // spaces spaceDelimited => spaces=x y (space encoded as + or %20 depending on encoder; URLSearchParams uses + in query component)
  expect(calledUrl).toMatch(/spaces=x(\+|%20)y/);
    // pipes pipeDelimited => pipes=p|q (| encoded as %7C)
    expect(calledUrl).toMatch(/pipes=p%7Cq/);
  });
});
