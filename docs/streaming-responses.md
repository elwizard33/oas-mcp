---
id: streaming-responses
title: Streaming Responses
sidebar_label: Streaming Responses
---

# Streaming Responses

Three layers of streaming support:

1. **Progressive Tool Events** (always) – start/progress/chunk/final events over MCP transport.
2. **Chunk Body Streaming** (mode `chunk`) – for large or indefinite response bodies.
3. **SSE Parsing Mode** – when upstream response is `text/event-stream`.

## Progressive Events
Every streamed call emits a `start` followed by zero or more `progress` and/or `chunk` events, then a `final` (or `error`). `progress` conveys semantic milestones (e.g. bytes read, parse steps) separate from raw body chunking.

## Chunk Mode

Trigger: `--stream-mode chunk` AND (no `content-length` OR size > threshold) OR explicit force via per-call argument. Non-streamed responses still return full body (subject to size limits).

Events (toolName prefix omitted):
| Event | Payload |
| ----- | ------- |
| `start` | `{ streamId, totalBytes? }` |
| `progress` | `{ streamId, receivedBytes, totalBytes? }` |
| `chunk` | `{ streamId, index, base64, size }` |
| `final` | `{ streamId, totalBytes, digest? }` |
| `error` | `{ streamId, message }` |

Final tool response returns metadata (not full body) if streamed.

## SSE Parsing
Upstream server-sent events are buffered logically (line-based) and surfaced as an array of `{ event?, data }` objects in the final result. Body streaming still applies if size/threshold conditions met.

## Threshold & Modes
Adjust with `--stream-threshold <bytes>` (default 64KB). `--stream-mode` options may include `auto` (default), `always`, `never`.

## SSE Fallback Endpoint
When `--sse-fallback` is enabled, non-MCP clients can subscribe to an SSE endpoint to receive the same progressive events (serialized JSON per line) – useful for thin HTTP tooling.

## Stateless Considerations
In stateless HTTP mode the same progression semantics apply, but no cross-request stream registry is retained after completion.

Next: [Metrics](metrics.md) and [Sampling Helpers](sampling.md).
