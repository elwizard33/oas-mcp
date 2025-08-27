---
id: streaming-event-contract
title: "Advanced: Streaming Event Contract"
sidebar_label: Streaming Event Contract
---

# Advanced: Streaming Event Contract

Related: [Streaming Responses](streaming-responses.md), [Handling Large / Binary Responses](handling-large-binary.md)

Event payload fields:

| Event | Fields |
| ----- | ------ |
| start | `streamId`, `totalBytes?` |
| chunk | `streamId`, `index`, `base64`, `size` |
| end | `streamId`, `totalBytes` |
| error | `streamId`, `message` |

Sequence guarantees: exactly one `start`, ordered `chunk` indices, exactly one terminal (`end` or `error`).

Consumer tip: assemble base64 chunks sequentially; decode at end to avoid partial overhead.

Next: [Development Setup](development-setup.md).
