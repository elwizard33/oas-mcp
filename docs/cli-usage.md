---
id: cli-usage
title: CLI Usage
sidebar_label: CLI Usage
---

# CLI Usage

Primary command:

```bash
oas-mcp serve [options]
```

## Options

| Flag | Default | Description |
| ---- | ------- | ----------- |
| `--port <n>` | 8080 | HTTP listen port |
| `--host <h>` | 127.0.0.1 | Bind host |
| `--debug` | false | Verbose logging |
| `--rate-limit-strategy <fixed\|token-bucket>` | fixed | Per-tool rate limiting mode |
| `--stream-mode <off\|chunk>` | off | Enable chunk streaming for large responses |
| `--stream-threshold <bytes>` | 65536 | Size threshold for streaming mode |
| `--name-collision-mode <suffix\|hash>` | suffix | Tool naming collision policy |
| `--cred-store <memory\|file>` | memory | Credential persistence backend |
| `--allow-file` | false | Allow local filesystem specs |
| `--verbose-names` | false | Use verbose host/path-derived tool names |
| `--protected` | false | Enable protected mode (bearer required + OAuth metadata) |
| `--auth-server <url>` | - | Authorization server base URL for metadata/proxy |
| `--auth-issuer <issuer>` | - | Override issuer value in metadata |
| `--token-audience <aud>` | - | Expected audience claim (JWT) |
| `--jwks-uri <url>` | - | JWKS endpoint for JWT signature validation |
| `--insecure-unsigned-tokens` | false | Allow unsigned/unverified tokens (testing) |
| `--proxy-register` | false | Proxy dynamic client registration to /register upstream |
| `--proxy-oauth` | false | Proxy token exchange to upstream /token endpoint |
| `--dns-rebind-protect` | false | Enforce host + remote address allowlist |
| `--allow-host <host...>` | - | Additional allowed hosts (DNS rebinding protection) |

## Credential Storage

When using `--cred-store file`, credentials are stored in:
```
.oas_mcps/creds.json
```

**⚠️ Important Security Notice**: Add credential directories to your `.gitignore`:
```gitignore
# OAS-MCP credential storage
.oas_mcps/
.mcp/
.mcp-credentials.json
```

The file store supports optional AES-GCM encryption via the `MCP_CRED_KEY` environment variable (hex-encoded key). Environment credential auto-import: variables prefixed `OAS_MCP_<SCHEMENAME>_TOKEN` (or `_USERNAME` / `_PASSWORD`, `_VALUE`) are ingested on first server creation.

## Example

```bash
oas-mcp serve \
  --port 8081 \
  --rate-limit-strategy token-bucket \
  --stream-mode chunk \
  --name-collision-mode hash \
  --cred-store file \
  --debug
```

Connect client:
```
/sse?schemaURL=https%3A%2F%2Fraw.githubusercontent.com%2Forg%2Fapi%2Fmain%2Fopenapi.yaml&baseURL=https://api.example.com
```

## Tool Name Construction
Format: `oasmcp_<METHOD>_<PATH>` sanitized. Collisions resolved per selected mode.

When `--name-collision-mode hash` a short stable hash fragment replaces numeric suffixes for ambiguous duplicates.

In verbose mode (`--verbose-names`) names derive from host + first path segments for readability.

## Protected Mode & OAuth Proxy
When `--protected` is enabled the server issues `WWW-Authenticate: Bearer` challenges and exposes:
- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`
Optional proxies (if `--proxy-register` / `--proxy-oauth`):
- `POST /register` (client registration passthrough)
- `POST /oauth/token` (token exchange; stores access token if server id provided)

JWT verification (if `--jwks-uri`) supports RS256 keys; audience (`--token-audience`) and issuer (`--auth-issuer`) validated.

## DNS Rebinding Protection
Enable with `--dns-rebind-protect`; only requests whose Host header and remote address fall within allowed sets (default: 127.0.0.1, localhost) pass. Extend with `--allow-host` entries.

Proceed: [Configuration](configuration.md).
