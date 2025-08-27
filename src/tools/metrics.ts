// Metrics tracking utilities extracted from mcpServer.ts for clarity & reuse
// This module intentionally contains no references to MCPServer to avoid cycles.

export interface RateLimitBucket {
  capacity: number;
  tokens: number;
  lastRefill: number;
  refillPerSec: number;
}

export interface MetricRecord {
  calls: number;
  errors: number;
  lastCallMs: number;
  windowStart: number;
  windowCount: number;      // incremented by rate limiting logic prior to record()
  windowErrors: number;     // incremented when errors happen within window
  currentSuccessStreak: number;
  currentFailureStreak: number;
  latencies: number[];      // rolling latency samples
  bucket?: RateLimitBucket; // token bucket state when strategy=token-bucket
}

export function createMetricRecord(now: number): MetricRecord {
  return { calls: 0, errors: 0, lastCallMs: 0, windowStart: now, windowCount: 0, windowErrors: 0, currentSuccessStreak: 0, currentFailureStreak: 0, latencies: [] };
}

// Update metrics for a call outcome
export function recordMetric(map: Map<string, MetricRecord>, name: string, ok: boolean, elapsedMs?: number) {
  const now = Date.now();
  let m = map.get(name);
  if (!m) { m = createMetricRecord(now); map.set(name, m); }
  m.calls++;
  if (ok) {
    m.currentSuccessStreak = (m.currentSuccessStreak || 0) + 1;
    m.currentFailureStreak = 0;
  } else {
    m.errors++; m.windowErrors++;
    m.currentFailureStreak = (m.currentFailureStreak || 0) + 1;
    m.currentSuccessStreak = 0;
  }
  m.lastCallMs = now;
  const WINDOW = 60_000; // 1 minute rolling window
  if (now - m.windowStart > WINDOW) {
    m.windowStart = now; m.windowCount = 0; m.windowErrors = 0; m.latencies = [];
  }
  if (elapsedMs !== undefined) {
    m.latencies.push(elapsedMs);
    if (m.latencies.length > 200) m.latencies.shift();
  }
}

export interface PublicMetricSnapshot {
  calls: number; errors: number; lastCallMs: number; windowCount: number; avgLatencyMs?: number; p95LatencyMs?: number; p99LatencyMs?: number; errorRatePct?: number; currentSuccessStreak: number; currentFailureStreak: number;
}

// Produce a plain object snapshot suitable for JSON serialization & tool response
export function snapshotMetrics(map: Map<string, MetricRecord>): Record<string, PublicMetricSnapshot> {
  const out: Record<string, PublicMetricSnapshot> = {};
  for (const [k,v] of map.entries()) {
    let avg: number | undefined; let p95: number | undefined; let p99: number | undefined;
    if (v.latencies.length) {
      const sorted = [...v.latencies].sort((a,b)=>a-b);
      const sum = v.latencies.reduce((a,b)=>a+b,0);
      avg = +(sum / v.latencies.length).toFixed(2);
      const idx = Math.min(sorted.length-1, Math.max(0, Math.floor(0.95 * (sorted.length)) - 1));
      p95 = +sorted[idx].toFixed(2);
      const idx99 = Math.min(sorted.length-1, Math.max(0, Math.floor(0.99 * (sorted.length)) - 1));
      p99 = +sorted[idx99].toFixed(2);
    }
    let errorRatePct: number | undefined = undefined;
    if (v.windowCount > 0) errorRatePct = +((v.windowErrors / v.windowCount) * 100).toFixed(2);
    out[k] = { calls: v.calls, errors: v.errors, lastCallMs: v.lastCallMs, windowCount: v.windowCount, avgLatencyMs: avg, p95LatencyMs: p95, p99LatencyMs: p99, errorRatePct, currentSuccessStreak: v.currentSuccessStreak || 0, currentFailureStreak: v.currentFailureStreak || 0 };
  }
  return out;
}
