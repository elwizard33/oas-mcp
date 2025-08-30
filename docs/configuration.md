---
id: configuration
title: Configuration Parameters
sidebar_label: Configuration
---

# Configuration

Configuration is supplied via CLI flags, environment variables, and (for the SSE / stateless HTTP adapter) query params.

## Core Query / Stateless Parameters

| Param | Required | Description |
| ----- | -------- | ----------- |
| `schemaURL` | yes | Location or data: URL of OpenAPI spec |
| `baseURL` | yes | Target API base origin |
| `filters` | no | Filter DSL (comma / semicolon separated) |
| `allowedDomains` | no | Comma-separated allowlist domains (SSRF guard) |
| `stateless` | no | If `1`, stateless evaluation (no persisted tool registry state) |
| `protected` | no | Enable bearer challenge + auth metadata endpoints |

## Filter DSL

Syntax samples:
```
method:GET
path:/users/*
!path:/internal/*
```
Multiple filters combine (include / exclude precedence: explicit exclude wins).

## Tool Naming & Collision Modes
`--tool-naming` controls canonical names:
- `flat` (default): direct operationId / derived
- `grouped`: `<tag>_<operation>` for multi-tag grouping clarity

Collision handling (`--collision-mode`):
- `suffix` → `_2`, `_3` … (stable increment)
- `hash` → `_abcdef` stable 6-char SHA256 fragment appended

## Rate Limiting & Retry Strategy
Inherited per call if not overridden in arguments. See [Rate Limiting](rate-limiting.md) and [Retry Policy](retry-policy.md). CLI flags: `--rate-limit-*`, `--retry-*`.

## Credential Store
`--cred-store memory` (volatile) or `file` (persists, optional encryption). Environment auto-import (`OAS_MCP_<SCHEME>_<ID>=value`) on first load. See [Credential Store](credential-store.md).

## Protected Mode
`--protected` adds:
- Bearer challenge responses
- Metadata endpoints (`/.well-known/oas-mcp`) for clients discovering resources/auth
- Token audience / issuer validation if configured

## OAuth Proxy
Optional pass-through to remote auth server:
- `--auth-server <base>` base URL
- `--proxy-register` enable dynamic client registration
- `--proxy-oauth` enable token grant proxy (auto-store credentials)
Related flags: `--jwks-uri`, `--token-audience`, `--auth-issuer`.

## DNS Rebinding Protection
Enable with `--dns-rebind-protect`; refine allowed hosts via repeated `--allow-host` flags. Rejects mismatched Host headers and remote addresses.

## Stateless Mode & SSE Fallback
`--stateless-http` exposes a one-shot evaluation endpoint ignoring in-memory tool registry; each request re-derives schemas. `--sse-fallback` enables an SSE endpoint for progressive streaming when full MCP transport unsupported.

## Streaming & Sampling
Progressive streaming events emit `chunk`, `progress`, `final`. Sampling helpers (e.g. `_sample_response_body`) expose resource records; see forthcoming Sampling guide.

## Resources & Prompts
Dynamic registry supports listing & hash-change notifications. Emitted via `resources/list` and `resources/list_changed` with granular `changed` names.

## Environment Variables Summary
- `MCP_CRED_KEY` hex-encoded 32-byte key for AES-GCM credential store encryption
- `OAS_MCP_*` prefixed variables for auto credential import
- `PORT` server port override (serve mode)

## Security Flags Quick Reference
`--dns-rebind-protect`, `--allow-host`, `--protected`, `--auth-server`, `--proxy-oauth`, `--proxy-register`, `--jwks-uri`, `--token-audience`, `--auth-issuer`, `--insecure-unsigned-tokens`, `--allow-file`.

Next: [OpenAPI Parsing & Caching](openapi-parsing-caching.md) and [Security](security.md).
