---
id: authentication-credentials
title: Authentication & Credentials
sidebar_label: Authentication & Credentials
---

# Authentication & Credentials

Security schemes parsed into credential management tools (prefix `_auth_`).

## Supported Schemes
| Type | Features |
| ---- | -------- |
| `apiKey` (header/query/cookie) | Value storage & injection |
| `http: basic` | Username/password base64 header |
| `http: bearer` | Static bearer token storage |
| `oauth2` | Client credentials, device code, auth code (PKCE), refresh |

## Credential Tools
Per scheme: `<id>_auth_<scheme>_set`, `_clear`. Listing: `<id>_auth_list_credentials` (masked output).

## OAuth Flows
- Client credentials: auto fetch & refresh
- Device code: start + poll tools
- Auth code: PKCE verifier generation + code exchange
- Refresh: background on-demand before expiry (30s buffer)

## Masking
All sensitive values masked except limited prefix/suffix for operator recognition; basic auth masks password only.

See guides: [Adding Credentials](adding-credentials.md), [OAuth Flows](oauth-flows.md).

Next: [Rate Limiting](rate-limiting.md).
