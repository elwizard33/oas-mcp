// migrated from test/metricsEnhancements.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';
import { parseRequestParams } from '../src/util/params.js';

const spec = { openapi: '3.0.0', info: {}, paths: { '/lat': { get: { summary: 'Latency' } } } };

function specUrl() { return 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)); }

describe('Metrics enhancements (avg, p95 & p99)', () => {
  it('computes avgLatencyMs, p95LatencyMs and p99LatencyMs', async () => {
    // Mock fetch with varying latencies
    const delays = [10, 20, 5, 40, 15, 25];
    let i = 0;
    const fetchMock = vi.fn(async () => {
      const d = delays[i++ % delays.length];
      await new Promise(r => setTimeout(r, d));
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json', entries: () => [['content-type','application/json']] },
        text: async () => JSON.stringify({ ok: true })
      } as any;
    });
    // @ts-ignore
    global.fetch = fetchMock;
    const params = await parseRequestParams({ s: specUrl(), u: 'https://example.com' });
    const server = await createMcpServer(params, { debug: false });
    const tool = server.listTools().find(t => t.name.endsWith('_get_lat'))!;
    for (let k=0;k<delays.length;k++) { await server.callTool(tool.name, {}); }
    const metricsTool = server.listTools().find(t => t.name.endsWith('_metrics'))!;
    const metricsResult = await server.callTool(metricsTool.name, {});
    const m = metricsResult.metrics;
  const entry = Object.values(m).find((e:any)=> (e as any).avgLatencyMs !== undefined && (e as any).p95LatencyMs !== undefined && (e as any).p99LatencyMs !== undefined) as any;
    expect(entry).toBeTruthy();
    if (entry) {
  expect(entry.avgLatencyMs).toBeGreaterThan(0);
  expect(entry.p95LatencyMs).toBeGreaterThanOrEqual(entry.avgLatencyMs); // p95 usually >= avg
  expect(entry.p99LatencyMs).toBeGreaterThanOrEqual(entry.p95LatencyMs); // p99 >= p95
    }
  });
});
