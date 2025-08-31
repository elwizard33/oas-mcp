---
id: adding-credentials
title: "Guide: Adding Credentials"
sidebar_label: Adding Credentials
---

# Guide: Adding Credentials

Related concepts: [Authentication & Credentials](authentication-credentials.md), [Credential Store](credential-store.md), [OAuth Flows](oauth-flows.md)

## Using the Frontend UI (Recommended)

The easiest way to add credentials is through the [Frontend Web Interface](frontend-ui.md):

1. **Start the server**: `oas-mcp serve --cred-store file`
2. **Open the frontend**: Navigate to http://localhost:5173 
3. **Configure authentication**: Select your auth type and enter credentials
4. **Save credentials**: Click "Save Credential" to store securely server-side
5. **Generate config**: Use the generated MCP server configuration

The frontend automatically handles credential storage, never includes secrets in URLs, and will surface environment-imported credentials (see below) for confirmation.

## Using JSON-RPC (Programmatic)

For direct API access or automation:

1. List credential tools: find `_auth_*_set` names.
2. Choose scheme (e.g. apiKey header). Example call:
```json
{ "method":"tools/call", "params": { "name": "oasmcp_auth_apiKey_set", "arguments": { "value": "KEY" } } }
```
3. Verify masking:
```json
{ "method":"tools/call", "params": { "name": "oasmcp_auth_list_credentials" } }
```
4. Call secured endpoint.
5. Clear if needed: `_auth_apiKey_clear`.

### Environment Auto-Import
On server start, variables matching `OAS_MCP_<SCHEME>_<ID>` are parsed and loaded once (if that credential id absent). Examples:
```
export OAS_MCP_apiKey_default=sk_live_x
export OAS_MCP_basic_myservice="user:pass"
```
Scheme portion maps to auth tool prefix (apiKey, basic, bearer, oauth2, cookie).

### OAuth Proxy Assisted Setup
If started with `--auth-server` and `--proxy-oauth`, you can exchange a code directly:
1. Get authorization code via browser against remote auth server.
2. Call `_auth_oauth2_exchange` tool (or use frontend) with `code`, `redirect_uri`, `server` id.
3. Access + refresh tokens stored (masked in listings).

Continue: [OAuth Flows](oauth-flows.md), [Security](security.md), plus [Rate Limiting](rate-limiting.md) and [Retry Policy](retry-policy.md) for post-auth resilience.
