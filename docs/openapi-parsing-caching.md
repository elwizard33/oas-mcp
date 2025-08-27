---
id: openapi-parsing-caching
title: OpenAPI Parsing & Caching
sidebar_label: OpenAPI Parsing & Caching
---

# OpenAPI Parsing & Caching

Steps:
1. Load raw spec (HTTP / data: / file if allowed).
2. Attempt dereference (resolving `$ref`).
3. Fallback parse (JSON → YAML) if dereference fails.
4. Extract endpoints (methods, parameters, request bodies, responses).
5. Extract & map security schemes.

## Caching

An in-memory LRU keyed by SHA256(rawSpec) (see `openapi/cache.ts`). Disable with `OASMCP_CACHE=0`.

Benefits: repeated sessions (identical spec) avoid parse/deref overhead in tests and dev.

## Composition Handling

- `allOf` simple merge (object-only, conflict-free) flagged `xMergedAllOf`.
- `oneOf` / `anyOf` summarized for requestBody schema.
- Discriminator mapping exposed via `xDiscriminator`.

Continue: [Endpoint Tool Generation](endpoint-tool-generation.md).
