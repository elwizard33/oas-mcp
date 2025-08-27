---
id: quick-start
title: Quick Start
sidebar_label: Quick Start
---

# Quick Start

Turn an OpenAPI file into a running MCP tool server in minutes.

## Option 1: Using the Frontend UI (Recommended)

The easiest way to get started is with the web interface:

```bash
# Start the server with file-based credential storage
oas-mcp serve --port 8080 --cred-store file

# In another terminal, start the frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and:
1. Upload or paste your OpenAPI spec
2. Configure your API base URL (auto-detected)
3. Set up authentication if needed
4. Copy the generated MCP server configuration
5. Add it to your MCP client (e.g., VS Code `mcp.json`)

See the [Frontend UI guide](frontend-ui.md) for detailed instructions.

## Option 2: Command Line

### 1. Install

```bash
npm install -g oas-mcp
```

(Or use `npx oas-mcp` for ad-hoc runs.)

### 2. Run the Server

```bash
oas-mcp serve --port 8080 --debug \
  --name-collision-mode hash \
  --rate-limit-strategy token-bucket \
  --stream-mode chunk
```

Connect a client to the SSE endpoint:
```
GET http://127.0.0.1:8080/sse?schemaURL=<encoded>&baseURL=https://api.example.com
```
Provide your spec location and target API base URL as query parameters.

### 3. List Tools

Send a JSON-RPC `tools/list` message over the SSE channel. Each operation appears with its input schema.

### 4. Call a Tool

`tools/call` with:
```json
{
  "method": "tools/call",
  "params": {
    "name": "oasmcp_get_/users_{id}",
    "arguments": {
      "pathNames": { "id": 123 },
      "searchParams": { "verbose": true }
    }
  }
}
```

## 5. Add Credentials

Use generated auth tools, e.g.:
```
name: oasmcp_auth_apiKey_set
arguments: { "value": "YOUR_KEY" }
```
Then call secured endpoints; headers/query/cookies are injected automatically.

## 6. Stream Large Responses

Enable `--stream-mode chunk` and responses larger than threshold (default 64KB) emit: `start`, `chunk`, `end` events with base64 segments. The final tool result contains summary metadata.

## 7. Inspect Metrics

Call `oasmcp_metrics` to view latency percentiles, error rates, and streak counters:
```json
{
  "metrics": {
    "oasmcp_get_/users": { "calls": 10, "p95LatencyMs": 180, "errorRatePct": 0 }
  }
}
```

## 8. Tweak Retry Policy Per Call

Add `retryPolicy` inside `arguments`:
```json
"retryPolicy": { "maxRetries": 3, "retryOnStatuses": [429, 503], "baseDelayMs": 150 }
```

## Troubleshooting

| Symptom | Fix |
| ------- | ---- |
| Tool not listed | Ensure schema path & filters allow it. Check `filters` param. |
| 401 / missing auth | Run appropriate `_auth_*_set` tool first; verify credential masking via `_auth_list_credentials`. |
| Streaming not triggered | Response smaller than threshold or `--stream-mode off`. |
| Rate limit errors | Increase `rateLimitPerMinute` argument or switch strategy. |

Move on to [CLI Usage](cli-usage.md) for all flags or explore [Authentication & Credentials](authentication-credentials.md).
