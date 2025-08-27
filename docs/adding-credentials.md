---
id: adding-credentials
title: Guide: Adding Credentials
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

The frontend automatically handles credential storage and never includes sensitive data in URLs.

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

Continue: [OAuth Flows](oauth-flows.md). Also see [Rate Limiting](rate-limiting.md) and [Retry Policy](retry-policy.md) for post-auth resilience.
