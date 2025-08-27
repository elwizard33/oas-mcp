---
id: security
title: Security
sidebar_label: Security
---

# Security

## SSRF & Domain Allowlist

Checks performed on `baseURL` host and each outbound call host:
- Private IPv4 (10/127/169.254/172.16-31/192.168) blocked
- IPv6 loopback / ULA / link-local blocked
- Optional domain allowlist: match exact or subdomain

## Local File Specs
Disabled unless `--allow-file`.

## Credential Masking
All credentials listed via `_auth_list_credentials` with masked values.

## OAuth Token Refresh
Proactive refresh 30s before expiry (silent failure model).

## Recommendations
- Keep allowlist tight in production
- Rotate encryption key for file store regularly
- Limit debug logging in production (may log URLs)

Next: Guides starting with [Adding Credentials](adding-credentials.md).
