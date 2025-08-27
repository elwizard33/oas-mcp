---
id: rate-limiting
title: Rate Limiting Strategies
sidebar_label: Rate Limiting
---

# Rate Limiting

Two strategies per tool:

## Fixed Window (default)
- 60s window; counters reset when window expires.
- Reject when prospective count would exceed `rateLimitPerMinute` (argument) or default 120.

## Token Bucket
- Capacity = limit/minute.
- Refill continuously (limit/60 tokens per second) capped at capacity.
- Reject when <1 token.

## Per-Call Override
Argument: `rateLimitPerMinute` (numeric). Strategy chosen via CLI `--rate-limit-strategy`.

Metrics windowCount/windowErrors reflect attempts.

Next: [Retry Policy](retry-policy.md).
