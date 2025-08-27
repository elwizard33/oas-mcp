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

The file store supports optional AES-GCM encryption via the `MCP_CRED_KEY` environment variable (hex-encoded key).

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

Proceed: [Configuration](configuration.md).
