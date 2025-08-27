---
id: retry-policy
title: Retry Policy
sidebar_label: Retry Policy
---

# Retry Policy

Default: GET methods retried up to 2 times on network errors only.

Override via `retryPolicy` object inside tool call arguments:
| Field | Meaning | Default |
| ----- | ------- | ------- |
| `maxRetries` | Attempts after initial | GET:2 else 0 |
| `baseDelayMs` | First backoff interval | 100 |
| `factor` | Exponential factor | 2 |
| `jitterPct` | Random jitter fraction | 0.5 |
| `retryOnMethods` | Eligible HTTP methods | [GET] |
| `retryOnStatuses` | HTTP status codes to retry | [] |

Backoff: `delay = base * factor^(attempt-1) + jitter(±jitterPct*base)`.

Result includes `retryAttempts` and enriched error fields (`attempt`, `cause`, `retryDelayMs`).

Next: [Streaming Responses](streaming-responses.md).
