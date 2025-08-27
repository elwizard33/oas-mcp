---
id: installation
title: Installation & Requirements
sidebar_label: Installation
---

# Installation & Requirements

`oas-mcp` targets **Node.js >= 18** (fetch, Web Streams, FormData native support). For streaming efficiency Node 20+ recommended.

## Install Globally

```bash
npm install -g oas-mcp
```

Run via CLI:

```bash
oas-mcp serve --port 8080
```

## Frontend Web Interface

For the React-based configuration UI, you'll also need to set up the frontend:

```bash
# Clone the repository or install locally
git clone https://github.com/elwizard33/oas-mcp.git
cd oas-mcp/frontend
npm install
```

The frontend requires:
- **Node.js >= 18**
- **Modern browser** with ES2020+ support
- **React 18.3+**, **TypeScript 5.5+**, **Vite 5.3+**

See [Frontend UI documentation](frontend-ui.md) for complete setup instructions.

## Ad-hoc (npx)

```bash
npx oas-mcp serve --debug
```

## Local Dev / Library Use

```bash
npm install oas-mcp --save-dev
```

Import:
```ts
import { createMcpServer } from 'oas-mcp';
```

## Minimum Spec Inputs

You need:
- `schemaURL`: URL / data: / (optionally) file path (with `--allow-file`)
- `baseURL`: Base HTTP origin for live calls

Both passed as query parameters when establishing SSE session.

## Optional Environment Variables

| Variable | Purpose |
| -------- | ------- |
| `MCP_CRED_KEY` | AES-GCM encryption key (hex/32 bytes) for file credential store |
| `OASMCP_CACHE` | Set `0` to disable OpenAPI parse cache |

## Security Notes

- Local file specs disabled by default (pass `--allow-file`).
- SSRF protection blocks private IPs and unlisted domains (if allowlist configured).

Continue with the [CLI Usage](cli-usage.md) guide.
