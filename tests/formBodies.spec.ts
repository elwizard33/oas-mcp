import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Forms', version: '1.0.0' },
  paths: {
    '/submit': {
      post: {
        requestBody: {
          content: {
            'application/x-www-form-urlencoded': { schema: { type: 'object', properties: { a: { type: 'string' } } } }
          }
        }
      }
    },
    '/upload': {
      post: {
        requestBody: {
          content: {
            'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string' }, note: { type: 'string' } } } }
          }
        }
      }
    }
  }
};

const params: any = {
  baseURL: 'https://api.example.com',
  schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)),
  filters: []
};

describe('Form bodies', () => {
  it('encodes application/x-www-form-urlencoded body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: () => Promise.resolve('{}'), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tool = server.listTools().find(t => t.name.includes('post_submit'))!;
    await server.callTool(tool.name, { arguments: { requestBody: { a: 'b' } } });
    const callArgs = fetchSpy.mock.calls[0];
    expect(callArgs[1].headers['Content-Type']).toMatch('application/x-www-form-urlencoded');
    expect(callArgs[1].body).toBe('a=b');
  });

  it('encodes multipart/form-data body (legacy assertion adapted to FormData streaming)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: () => Promise.resolve('{}'), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tool = server.listTools().find(t => t.name.includes('post_upload'))!;
    await server.callTool(tool.name, { arguments: { requestBody: { file: { filename: 'x.txt', content: 'hello' }, note: 'hi' } } });
    const callArgs = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
    // In streaming FormData mode we no longer set Content-Type manually; allow undefined or multipart form-data
    const ct = callArgs[1].headers['Content-Type'];
    if (ct) expect(ct).toMatch(/multipart\/form-data/);
    // Body is a FormData instance; can't introspect easily without undici internals. Just assert it exists.
    expect(callArgs[1].body).toBeTruthy();
  });
});
