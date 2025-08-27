import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'SSE Test', version: '1.0.0' },
  paths: {
    '/events': { get: { } }
  }
};

const params: any = { baseURL: 'https://sse.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('Streaming SSE parsing', () => {
  it('collects events array from text/event-stream', async () => {
    const ssePayload = [
      'event: update',
      'data: {"x":1}',
      '',
      'data: plain text line',
      '',
      'event: done',
      'data: {"ok":true}',
      '',
      ''
    ].join('\n');

    const fetchSpy = vi.fn(async (url: string) => {
      return { ok: true, status: 200, headers: new Headers({ 'content-type': 'text/event-stream' }), text: async () => ssePayload, arrayBuffer: async () => new ArrayBuffer(0) } as any;
    });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tool = server.listTools().find(t => t.name.includes('get_events'))!.name;

    const resp: any = await server.callTool(tool, { arguments: {} });
    expect(resp.ok).toBe(true);
    expect(resp.sse).toBeTruthy();
    expect(resp.sse.length).toBe(3);
    expect(resp.sse[0]).toEqual({ event: 'update', data: { x:1 } });
    expect(resp.sse[1]).toEqual({ data: 'plain text line' });
    expect(resp.sse[2]).toEqual({ event: 'done', data: { ok: true } });
  });
});
