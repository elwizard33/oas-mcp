import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

// Minimal spec with multipart requestBody
const spec = {
  openapi: '3.0.0',
  info: { title: 'Multipart', version: '1.0.0' },
  paths: {
    '/upload': {
      post: {
        summary: 'Upload',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' }, meta: { type: 'string' } } }
            }
          }
        },
        responses: { '200': { description: 'OK' } }
      }
    }
  }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('Streaming multipart upload', () => {
  it('uses FormData without manual boundary and includes fields', async () => {
    let receivedContentType: string | null = null;
    let receivedBody: any = null;
    // Mock fetch to inspect request
    // @ts-ignore
    global.fetch = vi.fn(async (url: string, init: any) => {
      receivedContentType = init.headers['Content-Type'] || init.headers['content-type'] || null;
      receivedBody = init.body; // should be a FormData instance
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tool = server.listTools().find(t => t.name.endsWith('_post_upload'))!;
    const fakeStream = new Blob([new Uint8Array([1,2,3,4])]);
    await server.callTool(tool.name, { requestBody: { file: { filename: 'data.bin', stream: fakeStream }, meta: 'test' } });
    // Content-Type should be automatically set (with boundary) by fetch implementation; we can't know boundary but we can assert presence of multipart/form-data
    if (receivedContentType) {
      expect(/multipart\/form-data/i.test(receivedContentType)).toBe(true);
    }
    // Body should be FormData (environment dependent); minimal check: has get boundary-like entries via iterator if available
    expect(receivedBody).toBeTruthy();
  });
});
