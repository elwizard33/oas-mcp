---
id: name-collision-modes
title: Advanced: Name Collision Modes
sidebar_label: Name Collision Modes
---

# Advanced: Name Collision Modes

Related: [Endpoint Tool Generation](endpoint-tool-generation.md), [Filtering Endpoints](filtering-endpoints.md)

Two strategies when sanitized names collide:

| Mode | Example |
| ---- | ------- |
| suffix | `_2`, `_3` appended |
| hash | `_a1b2c3` (stable 6-char SHA256) |

Hash mode reduces drift if operation order changes.

Next: [Credential Store](credential-store.md).
