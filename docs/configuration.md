---
id: configuration
title: Configuration Parameters
sidebar_label: Configuration
---

# Configuration

Configuration is supplied via SSE query params & CLI flags.

## Core Query Parameters

| Param | Required | Description |
| ----- | -------- | ----------- |
| `schemaURL` | yes | Location or data: URL of OpenAPI spec |
| `baseURL` | yes | Target API base origin |
| `filters` | no | Filter DSL (comma / semicolon separated) |
| `allowedDomains` | no | Comma-separated allowlist domains |

## Filter DSL

Syntax samples:
```
method:GET
path:/users/*
!path:/internal/*
```
Multiple filters combine (include / exclude precedence: explicit exclude wins).

## Name Collision Mode
`suffix` → `_2`, `_3` …
`hash` → `_abcdef` stable 6-char SHA256 fragment.

## Rate Limiting Strategy
Inherited per call if not overridden in arguments. See [Rate Limiting](rate-limiting.md).

## Credential Store
`memory` (volatile) or `file` (persists, optional encryption).

Next: [OpenAPI Parsing & Caching](openapi-parsing-caching.md).
