---
id: overview
title: Overview
sidebar_label: Overview
---

# oas-mcp Overview

`oas-mcp` converts any OpenAPI 3.x specification into a live suite of Model Context Protocol (MCP) tools exposed over Server‑Sent Events (SSE) + JSON‑RPC. Each HTTP operation in the OpenAPI document becomes a callable tool with a structured input schema, automatic credential injection, retry & rate limiting, and rich response envelope.

The project includes both a **server component** for OpenAPI → MCP conversion and a **React-based web interface** for easy configuration and credential management.

## Key Features

### Core Server
- Automatic endpoint → tool generation (lazy; created on first access)
- Typed input schemas (path/query/body) including merged `allOf` and summarized `oneOf`/`anyOf`
- Security scheme parsing (apiKey, basic, bearer, OAuth2 flows) + credential management tools
- Automatic header/query/cookie injection with token refresh support
- Configurable rate limiting (fixed window or token bucket)
- Retry policy with exponential backoff + jitter (per tool override)
- Streaming modes: chunked large-response streaming + SSE event parsing
- Metrics (latency stats p95/p99, streaks, error rate, rolling window counts)
- SSRF & domain allowlist protections (private IP & disallowed host blocking)
- Multipart & form bodies, query array style handling, collision-resistant tool naming
- Credential stores (memory/file with optional encryption key)

### Frontend Web Interface
- **User-friendly configuration**: Upload/paste OpenAPI specs with automatic validation
- **Secure credential management**: Multiple authentication types with server-side storage
- **Automatic setup generation**: Ready-to-use MCP server configurations
- **Connected server tracking**: Manage multiple API integrations
- **No sensitive data in URLs**: All credentials stored securely server-side

## Architecture Modules (High Level)

| Module | Responsibility |
| ------ | -------------- |
| `openapi/parser` | Parse & dereference spec, build endpoint list & security map |
| `tools/generation` | Lazy registration & runtime handler (request assembly, retries, streaming) |
| `tools/authTools` / `tools/oauthFlows` | Credential configuration & OAuth flows |
| `tools/metrics` | Metric recording & snapshot aggregation |
| `tools/streaming` | SSE parsing & chunked response emission events |
| `cred/store` | Pluggable credential persistence (memory/file) |
| `filters/dsl` | Endpoint include/exclude filtering syntax |
| `util/*` | Helpers (sanitization, params parsing, base64, hashing) |

## Response Envelope

Each tool call returns an object like:

```json
{
  "status": 200,
  "ok": true,
  "headers": { "content-type": "application/json" },
  "elapsedMs": 123,
  "body": "{...raw text or placeholder...}",
  "json": { "parsed": true },
  "base64": "..." ,
  "sse": [ { "event": "message", "data": "..." } ],
  "error": { "type": "http", "message": "HTTP 500" },
  "retryAttempts": 1
}
```
Fields only appear when relevant. For streamed responses, a separate event flow is emitted (see Streaming Concepts page).

## When to Use

Use `oas-mcp` when you want a rapid, zero-handwritten-code bridge from an existing OpenAPI spec to an MCP-compliant tool surface usable by AI agents or other automation needing structured discovery and invocation.

## Next Steps

- Start with the [Quick Start](quick-start.md)
- Understand [CLI Usage](cli-usage.md)
- Dive into [Authentication & Credentials](authentication-credentials.md)
- Explore runtime [Streaming Responses](streaming-responses.md) and [Metrics](metrics.md)
