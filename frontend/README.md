# OAS-MCP Frontend

Simple React + Vite UI to paste or upload an OpenAPI 3.x spec and produce a config JSON scaffold for running `oas-mcp`.

📖 **For complete documentation, see**: [Frontend UI Guide](https://elwizard33.github.io/oas-mcp/frontend-ui)

## Features
- Paste or upload JSON/YAML spec
- Dereference & basic validation via swagger-parser
- Configure runtime options (baseURL, rate limiting strategy, streaming, name collision mode, credential store)
- Live JSON config preview
- Copy or download config
- Secure credential management with server-side storage
- Connected MCP server tracking

## Development
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Build
```bash
npm run build
```
Output in `dist/` for static hosting.

## Notes
This UI does not persist specs remotely; all processing is client-side. Large specs may impact performance.
