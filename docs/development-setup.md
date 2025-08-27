---
id: development-setup
title: "Contributing: Development Setup"
sidebar_label: Development Setup
---

# Contributing: Development Setup

Requirements: Node >=18, npm.

```bash
git clone https://github.com/elwizard33/oas-mcp
cd oas-mcp
npm install
npm test
```

Common scripts:
| Script | Action |
| ------ | ------ |
| `dev` | Start local server with live TS via tsx |
| `test` | Run vitest suite |
| `build` | TypeScript build (dist) |
| `lint` | ESLint |

PR checklist:
- Tests updated / added
- No lint errors
- Docs updated if public API changed

Next: [Architecture Overview](architecture-overview.md).
