---
id: metrics
title: Metrics
sidebar_label: Metrics
---

# Metrics

Tool `*_metrics` returns per-tool snapshot:

| Field | Meaning |
| ----- | ------- |
| `calls` | Total invocations |
| `errors` | Total error outcomes |
| `windowCount` | Count in current 60s window |
| `avgLatencyMs` | Mean latency (rolling) |
| `p95LatencyMs` | 95th percentile latency |
| `p99LatencyMs` | 99th percentile latency |
| `errorRatePct` | Window error percentage |
| `currentSuccessStreak` | Consecutive successes |
| `currentFailureStreak` | Consecutive failures |

Rolling latencies capped (200 samples) for percentile efficiency.

Use metrics to tune retry, rate limit, streaming thresholds.

Next: [Security](security.md).
