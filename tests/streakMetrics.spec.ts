// migrated from test/streakMetrics.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';
import { parseRequestParams } from '../src/util/params.js';

const spec = { openapi: '3.0.0', info: {}, paths: { '/streak': { get: { summary: 'Streak test' } } } };
function specUrl() { return 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)); }

describe('Success/Failure streak metrics', () => {
  it('tracks currentSuccessStreak and currentFailureStreak', async () => {
    let call = 0;
    const pattern = [200,200,500,500,500,200];
    const fetchMock = vi.fn(async () => {
      const status = pattern[call] ?? 200;
      call++;
      const ok = status >= 200 && status < 300;
      return new Response(JSON.stringify({ ok }), { status, headers: { 'content-type': 'application/json' } });
    });
    // @ts-ignore
    global.fetch = fetchMock;
    const params = await parseRequestParams({ s: specUrl(), u: 'https://example.com' });
    const server = await createMcpServer(params, { debug: false });
  const tool = server.listTools().find(t => /_get_/.test(t.name) && t.name.includes('streak'))!;
    for (let i=0;i<pattern.length;i++) { await server.callTool(tool.name, {}); }
    const metricsTool = server.listTools().find(t => t.name.endsWith('_metrics'))!;
    const metrics: any = await server.callTool(metricsTool.name, {});
    const entry = Object.values(metrics.metrics).find((e:any)=> e.currentSuccessStreak !== undefined && e.currentFailureStreak !== undefined) as any;
    expect(entry).toBeTruthy();
    if (entry) {
      expect(entry.currentSuccessStreak).toBe(1);
      expect(entry.currentFailureStreak).toBe(0);
      expect(entry.calls).toBe(pattern.length);
      expect(entry.errors).toBe(3);
    }
  });
});
