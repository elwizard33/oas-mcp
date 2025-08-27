---
id: endpoint-tool-generation
title: Endpoint Tool Generation
sidebar_label: Endpoint Tool Generation
---

# Endpoint Tool Generation

Each path + method becomes a lazily registered tool (`registerLazy`). Tools instantiated on first `list` or `call` to minimize startup cost for large specs.

## Naming

Base: `oasmcp_<METHOD>_<PATH>` → sanitized (non-alphanumerics → `_`). Collisions resolved per mode.

## Input Schema Construction

Includes sections when present:
- `pathNames` (required path params)
- `searchParams` (query params with style/explode semantics)
- `requestBody` (merged or summarized structure)
- `retryPolicy` override object

## Runtime Handler Responsibilities
1. Path interpolation & required validation
2. Query serialization (array styles: form, csv, spaceDelimited, pipeDelimited, repeated)
3. Body encoding (json, urlencoded, multipart)
4. Credential selection (first fully satisfied security requirement)
5. Header/query/cookie injection
6. Rate limiting gate
7. Retry loop (eligible methods + statuses + network errors)
8. Streaming decision (content-length vs threshold)
9. Response shaping (status, headers, text/json/base64, SSE parse)
10. Metrics record

Proceed: [Authentication & Credentials](authentication-credentials.md).
