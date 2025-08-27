---
id: streaming-responses
title: Streaming Responses
sidebar_label: Streaming Responses
---

# Streaming Responses

Two paradigms:

1. **Chunk Streaming** (mode `chunk`) for large/boundless bodies.
2. **SSE Parsing** when content-type `text/event-stream`.

## Chunk Mode

Trigger: `--stream-mode chunk` AND (no `content-length` OR > threshold).

Events emitted (toolName prefix omitted):
| Event | Payload |
| ----- | ------- |
| `start` | `{ streamId, totalBytes? }` |
| `chunk` | `{ streamId, index, base64, size }` |
| `end` | `{ streamId, totalBytes }` |
| `error` | `{ streamId, message }` |

Final tool response returns metadata (not full body) if streamed.

## SSE Parsing
Buffers entire stream; splits lines starting `data:` or `event:` into array entries.

## Threshold
Adjust with `--stream-threshold <bytes>` (default 64KB).

Next: [Metrics](metrics.md).
