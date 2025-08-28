<div align="center">
	<h1>OAS → MCP Server</h1>
	<p><strong>Turn any OpenAPI 3.x spec into a suite of Model Context Protocol tools (JSON-RPC over SSE) in seconds.</strong></p>
	<p>
		<a href="https://github.com/elwizard33/oas-mcp/actions/workflows/pages.yml"><img alt="Deploy" src="https://github.com/elwizard33/oas-mcp/actions/workflows/pages.yml/badge.svg" /></a>
		<a href="https://www.npmjs.com/package/oas-mcp"><img alt="npm version" src="https://img.shields.io/npm/v/oas-mcp.svg?color=cb3837" /></a>
		<a href="https://www.npmjs.com/package/oas-mcp"><img alt="npm downloads" src="https://img.shields.io/npm/dm/oas-mcp.svg" /></a>
		<img alt="Node version" src="https://img.shields.io/node/v/oas-mcp.svg" />
		<img alt="Types" src="https://img.shields.io/badge/types-TypeScript-blue.svg" />
		<a href="https://elwizard33.github.io/oas-mcp"><img alt="Docs (Astro)" src="https://img.shields.io/badge/docs-astro-%230073ff" /></a>
		<a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-lightgrey" /></a>
	</p>
	<sub>Lazy endpoint tool generation • Rate limiting (fixed + token bucket) • Retry policies • OAuth flows • Streaming (chunk + SSE) • Metrics (p95/p99, streaks, error rate) • Credential stores (memory/file + optional encryption) • SSRF protections</sub>
</div>

---

## Contents
- [Overview](#overview)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [CLI Usage](#cli-usage)
- [Frontend Web Interface](#frontend-web-interface)
- [Programmatic Usage](#programmatic-usage)
- [Connecting (SSE Session)](#connecting-sse-session)
- [Tool Generation](#tool-generation)
- [Filter DSL](#filter-dsl)
- [Input Schema](#input-schema)
- [Response Envelope](#response-envelope)
- [Retry Policy](#retry-policy)
- [Rate Limiting & Metrics](#rate-limiting--metrics)
- [Authentication & Credentials](#authentication--credentials)
- [Streaming & Large Responses](#streaming--large-responses)
- [Security](#security)
- [Architecture](#architecture)
- [Examples](#examples)
- [Docs Site](#docs-site)
- [Contributing](#contributing)
- [Security Policy](#security-policy)
- [License](#license)

## Overview
The server ingests an OpenAPI 3.x document (remote URL, `data:` URI, or optional local file) and exposes each qualifying operation as a lazily registered MCP tool. The result: an instantly navigable tool surface you can list and invoke via a single SSE + JSON-RPC connection. Advanced features (retry, streaming, OAuth, metrics) layer transparently on top of the generated handlers.

Key capabilities:
- Zero manual tool boilerplate: spec → tools automatically.
- Lazy instantiation: endpoints build only when first listed or called (fast startup on huge specs).
- Robust pipeline: parameter interpolation, query style handling, body encoding (json, form, multipart), credential injection, rate limiting, retries, streaming decision, metrics recording.
- Pluggable credential stores: in-memory or encrypted-on-disk (AES-GCM) with masked listing.
- OAuth flows: client credentials, device code, authorization code (PKCE), automatic refresh.
- Streaming: large/boundless responses chunked; SSE streams parsed into structured events.
- Metrics: latency (avg/p95/p99), window stats, error rate, success/failure streaks per tool.
- Security: SSRF host validation, optional domain allowlist, disabled local file specs by default.

## Quick Start
```bash
npx oas-mcp serve --port 8080 \
	--schema https://raw.githubusercontent.com/org/demo/main/openapi.yaml \
	--base https://api.example.com \
	--rate-limit-strategy token-bucket \
	--stream-mode chunk
```

Open an SSE session in a client (URL encoding implied):
```
/sse?schemaURL=https://raw.githubusercontent.com/org/demo/main/openapi.yaml&baseURL=https://api.example.com
```

Minimal inline spec demo:
```bash
SPEC='data:application/json,'$(node -e "process.stdout.write(encodeURIComponent(JSON.stringify({openapi:'3.0.0',info:{title:'Demo',version:'1.0.0'},paths:{'/ping':{get:{summary:'Ping',responses:{'200':{description:'ok'}}}}}})))")
open "http://127.0.0.1:8080/sse?schemaURL=$SPEC&baseURL=https://example.com"
```

## Installation
```bash
npm install oas-mcp
```

## CLI Usage
```bash
oas-mcp serve [options]
```
| Flag | Default | Description |
| ---- | ------- | ----------- |
| `--port <n>` | 8080 | HTTP listen port |
| `--host <h>` | 127.0.0.1 | Bind host |
| `--debug` | false | Verbose logging |
| `--allow-file` | false | Enable local file specs |
| `--rate-limit-strategy <fixed|token-bucket>` | fixed | Rate limiting algorithm |
| `--stream-mode <off|chunk>` | off | Streaming decision mode |
| `--stream-threshold <bytes>` | 65536 | Chunk threshold |
| `--name-collision-mode <suffix|hash>` | suffix | Tool naming collision strategy |
| `--cred-store <memory|file>` | memory | Credential persistence backend |

## Frontend Web Interface
A React-based web interface is available for easier configuration and credential management:

```bash
# Start the server
npx oas-mcp serve --port 8080 --cred-store file

# In another terminal, start the frontend
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 to access the interface where you can:
- Upload or paste OpenAPI specifications  
- Configure server settings with auto-detection
- Manage authentication credentials securely
- Generate ready-to-use MCP server configurations
- Track connected MCP servers

The frontend stores credentials server-side and never includes sensitive data in generated URLs. See the [Frontend UI documentation](https://elwizard33.github.io/oas-mcp/frontend-ui) for complete details.

**⚠️ Important**: When using file-based credential storage, add `.oas_mcps/` to your `.gitignore` to avoid committing sensitive data.

## Programmatic Usage
```ts
import { startServer, createMcpServer } from 'oas-mcp';
import type { HttpResponseEnvelope, ParsedParams, ToolDescriptor } from 'oas-mcp/shared';

await startServer({ host: '127.0.0.1', port: 8080, debug: false });

const server = await createMcpServer({
	schemaURL: 'https://example.com/openapi.json',
	baseURL: 'https://api.example.com'
} as ParsedParams, { debug: true });

console.log(server.listTools());
```

## Connecting (SSE Session)
```
/sse?schemaURL=<ENCODED_SPEC_URL>&baseURL=<BASE_API_URL>&filters=<FILTER_DSL>
```
The first SSE event returns the JSON-RPC postback endpoint: `/message?sessionId=<id>`.

## Tool Generation
Pattern: `oasmcp_<METHOD>_<PATH>` (sanitized). Collisions resolved via suffix (`_2`) or stable hash fragment. Tools are created lazily; first list/call triggers handler build.

## Filter DSL
Examples (comma or semicolon separated):
| Expression | Meaning |
| ---------- | ------- |
| `method:GET` | Only GET operations |
| `path:/users/*` | Paths under /users |
| `!path:/internal/*` | Exclude internal paths |

## Input Schema
Sections (when applicable): `pathNames`, `searchParams`, `requestBody`, optional `retryPolicy` override.

## Response Envelope
Tool result core fields:
```jsonc
{
	"status": 200,
	"ok": true,
	"headers": { "content-type": "application/json" },
	"body": "<raw text or stub>",
	"json": { },
	"base64": "<inline if small>",
	"sse": [ { "event": "message", "data": "..." } ],
	"retryAttempts": 1,
	"elapsedMs": 42,
	"error": { "type": "http|timeout|network|read", "message": "...", "status": 500, "attempt": 1, "cause": "ECONNRESET" }
}
```

## Retry Policy
Defaults: GET retried 2x on network errors. Override per call:
```ts
retryPolicy: { maxRetries: 3, baseDelayMs: 100, factor: 2, jitterPct: 0.5, retryOnMethods: ["GET","POST"], retryOnStatuses: [429,503] }
```

## Rate Limiting & Metrics
- Strategies: fixed window (default), token bucket (smooth refill).
- Per-call override: `rateLimitPerMinute`.
- Metrics include calls, errors, avg/p95/p99 latency, window counts, errorRatePct, success/failure streaks.

Query metrics via generated `<id>_metrics` tool.

## Authentication & Credentials
Supported schemes: apiKey (header/query/cookie), http basic, http bearer, oauth2 (client creds, device, auth code + PKCE, refresh). Generated tools manage set/clear & OAuth flow steps. Sensitive values masked in listings.

## Streaming & Large Responses
- Chunk streaming (mode `chunk`) for large/unknown size bodies (base64 chunk events).
- SSE parsing: `text/event-stream` converted into array of events.
- Threshold configurable via `--stream-threshold`.

## Security
Protections:
- SSRF guard: private IP & loopback blocks; optional allowlist.
- Local spec loading disabled by default.
- Credential masking & optional AES-GCM encryption for file store (env `MCP_CRED_KEY`).

Refer to [SECURITY.md](./SECURITY.md) for vulnerability reporting.

## Architecture
```
 Client ──(SSE /sse)──► Session ──(POST /message?sessionId=..)──► JSON-RPC Router
																				 │
																				 ├─ Lazy Tool Registry (generated on demand)
																				 ├─ Credential Store (memory | file[enc])
																				 ├─ Rate Limiter (fixed | bucket)
																				 ├─ Retry / Backoff Engine
																				 ├─ Streaming Dispatcher (chunk/SSE)
																				 └─ Metrics Recorder
```
Flow: Parse + cache spec → create auth tools + register lazy endpoint factories → on first call build handler → execute pipeline → metrics + response.

## Examples
See `examples/` for minimal startup and in-memory usage patterns.

## Docs Site
Full documentation (concepts, guides, advanced topics, API reference) is built with **Astro + TypeDoc** and deployed via GitHub Pages actions (artifact → Pages). The site is regenerated on pushes that touch docs, source, or configuration.

👉 https://elwizard33.github.io/oas-mcp

_Note: Previously powered by Docusaurus; migrated to Astro for a lighter, zero-Webpack static pipeline and simpler integration with existing markdown + generated API docs._

## Contributing
Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md). Development scripts:
```bash
npm install
npm run dev
npm test
```

## Security Policy
See [SECURITY.md](./SECURITY.md). Report issues responsibly.


## License
MIT © 2025

---
<sub>Built with TypeScript. Feedback & contributions welcome.</sub>
