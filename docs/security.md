---
id: security
title: Security
sidebar_label: Security
---

# Security

## SSRF & Network Guards

Checks on `baseURL` and every outbound request host:
- Private IPv4 (10/127/169.254/172.16-31/192.168) blocked unless explicitly allowed
- IPv6 loopback / ULA / link-local blocked
- Optional domain allowlist (exact or subdomain)
- Data URLs supported; local file specs gated by `--allow-file`

## DNS Rebinding Protection
Optional runtime gate (`--dns-rebind-protect`): rejects requests whose Host header or remote address fall outside the allowlist (default includes bound host, localhost, loopback). Extend with `--allow-host`.

## Protected Mode & Bearer Challenges
`--protected` enables:
- `WWW-Authenticate: Bearer` challenges for unauthenticated endpoints
- Well-known metadata endpoints for resource + authorization server discovery
- Audience (`--token-audience`) & issuer (`--auth-issuer`) validation if supplied
- JWT signature verification via JWKS (`--jwks-uri`, RS256) unless `--insecure-unsigned-tokens`.

## OAuth Proxy Endpoints
When combined with `--auth-server` and flags:
- `POST /register` (`--proxy-register`) proxies dynamic client registration
- `POST /oauth/token` (`--proxy-oauth`) proxies token grants (client_credentials, authorization_code, refresh_token) and stores resulting tokens automatically when `server` id provided in payload.

## Local File Specs
Disabled unless `--allow-file`; guarded by path containment check to prevent directory traversal.

## Credential & Environment Handling
Credentials listed via metrics/auth tools with masked values. File store optionally AES-GCM encrypted (`MCP_CRED_KEY`). Environment auto-import (prefix `OAS_MCP_`) ingests credentials per security scheme on first instantiation.

## OAuth Token Refresh & Storage
Access tokens (client credentials / refresh flows) are refreshed ~30s before expiry when possible; failures are non-fatal (tool call may later surface 401).

## Resource Integrity Notifications
Resource registry emits debounced hash-based `resources/list_changed` notifications including `changed` names for efficient client cache invalidation.

## Recommendations
- Keep allowlist strict in production
- Rotate `MCP_CRED_KEY` regularly (re-encrypt store)
- Disable `--insecure-unsigned-tokens` outside test environments
- Avoid broad `--allow-host *` patterns; enumerate explicit hosts
- Limit debug logging (may include endpoint paths)

Next: [Adding Credentials](adding-credentials.md) or [Authentication & Credentials](authentication-credentials.md).
