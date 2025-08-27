// migrated from test/errorProvenance.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';
import { parseRequestParams } from '../src/util/params.js';
import type { ToolError } from '../src/types/shared.js';

const spec = { openapi: '3.0.0', info: {}, paths: { '/err': { get: { summary: 'Err' }, post: { summary: 'ErrPost' } } } };

function makeServerSpecUrl() { return 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)); }

describe('Enhanced error provenance', () => {
  it('captures network error fields (attempt, retryDelayMs, cause)', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('boom1'), { name: 'Boom1' }))
      .mockRejectedValueOnce(Object.assign(new Error('boom2'), { name: 'Boom2' }))
      .mockRejectedValue(Object.assign(new Error('boom3'), { name: 'Boom3' }));
    // @ts-ignore
    global.fetch = fetchMock;
    const params = await parseRequestParams({ s: makeServerSpecUrl(), u: 'https://example.com' });
    const server = await createMcpServer(params, { debug: false });
    const tool = server.listTools().find(t => t.name.endsWith('_get_err'))!;
    const res: any = await server.callTool(tool.name, {});
    expect(res.error).toBeTruthy();
    const err = res.error as ToolError;
    expect(err.type).toBe('network');
    expect(typeof err.attempt).toBe('number');
    expect(err.attempt).toBeGreaterThanOrEqual(2); // after retries exhausted (max 2 retries => attempt index 2)
    expect(err.retryDelayMs).toBeGreaterThan(0);
    expect(err.cause).toBeTruthy();
  });

  it('captures timeout error with attempt field', async () => {
    const fetchMock = vi.fn(() => {
      const err: any = new Error('aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });
    // @ts-ignore
    global.fetch = fetchMock;
    const params = await parseRequestParams({ s: makeServerSpecUrl(), u: 'https://example.com' });
    const server = await createMcpServer(params, { debug: false });
  // Use POST to avoid retries and force single timeout attempt
  const tool = server.listTools().find(t => t.name.endsWith('_post_err'))!;
  const res: any = await server.callTool(tool.name, { timeoutMs: 10 });
    expect(res.error).toBeTruthy();
    const err = res.error as ToolError;
    expect(err.type).toBe('timeout');
    expect(typeof err.attempt).toBe('number');
  });
});
