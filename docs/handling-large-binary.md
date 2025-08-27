---
id: handling-large-binary
title: "Guide: Handling Large / Binary Responses"
sidebar_label: Handling Large / Binary Responses
---

# Guide: Handling Large / Binary Responses

Related: [Streaming Responses](streaming-responses.md), [Metrics](metrics.md)

Scenarios:
- Small binary (&lt;=128KB): base64 inline
- Large binary: truncated placeholder or streamed (chunk mode)

Tips:
| Goal | Advice |
| ---- | ------ |
| Full large download | Enable streaming chunk mode |
| Avoid memory spikes | Stream; adjust threshold downward |
| Inspect headers only | Call and ignore body fields |

Next: [Filtering Endpoints](filtering-endpoints.md).
