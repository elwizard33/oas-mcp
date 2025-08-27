// migrated from test/errorRateMetric.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';
import { parseRequestParams } from '../src/util/params.js';

const spec = { openapi: '3.0.0', info: {}, paths: { '/flip': { get: { summary: 'Flaky' } } } };
function specUrl() { return 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)); }

describe('Error rate metric', () => {
  it('computes errorRatePct over current window', async () => {
    // Alternate success / failure
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      if (call % 2 === 0) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
      } else {
        return new Response(JSON.stringify({ error: true }), { status: 500, headers: { 'content-type': 'application/json' } });
      }
    });
    // @ts-ignore
    global.fetch = fetchMock;
    const params = await parseRequestParams({ s: specUrl(), u: 'https://example.com' });
    const server = await createMcpServer(params, { debug: false });
  const tool = server.listTools().find(t => /_get_/.test(t.name) && t.name.includes('flip'))!;
    // Make 6 calls: expect ~50% errors (3 of 6)
    for (let i=0;i<6;i++) {
      await server.callTool(tool.name, {});
    }
    const metricsTool = server.listTools().find(t => t.name.endsWith('_metrics'))!;
    const metricsResult: any = await server.callTool(metricsTool.name, {});
    const entry = Object.values(metricsResult.metrics).find((e:any)=> e.errorRatePct !== undefined && e.windowCount >= 6) as any;
    expect(entry).toBeTruthy();
    if (entry) {
      expect(entry.errorRatePct).toBeGreaterThan(45);
      expect(entry.errorRatePct).toBeLessThan(55);
    }
  });
});
