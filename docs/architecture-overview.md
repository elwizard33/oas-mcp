---
id: architecture-overview
title: Contributing: Architecture Overview
sidebar_label: Architecture Overview
---

# Architecture Overview

Major modules & flow:

1. CLI parses flags → starts HTTP server.
2. SSE endpoint initializes MCPServer via `createMcpServer`.
3. Parser loads / caches OpenAPI spec.
4. Auth tools & endpoint lazy registrations created.
5. Tool call executes handler pipeline → metrics + response.
6. Streaming events emitted when applicable.

Key files:
| File | Purpose |
| ---- | ------- |
| `src/tools/mcpServer.ts` | Server construction, SSRF checks, wiring |
| `src/tools/generation.ts` | Endpoint handler logic |
| `src/tools/authTools.ts` | Credential management tools |
| `src/tools/oauthFlows.ts` | OAuth flow implementations |
| `src/tools/streaming.ts` | Streaming & SSE parsing |
| `src/tools/metrics.ts` | Metric recording / snapshot |
| `src/openapi/parser.ts` | Spec parsing & security extraction |

Next: [Changelog](changelog-link.md).
