# MCP Feature Matrix

Status of implemented vs pending advanced MCP features in this server.

## Implemented
- Tool registration via official SDK (registerTool)
- Dynamic tool enable/disable/remove with debounced list_changed notification
- Basic rate limiting per tool
- Metrics collection & metrics tool
- Retry policy get/set tools
- Credential management (list/set/clear/refresh/import env)
- OAuth token refresh (client credentials & refresh token)
- JSON Schema -> Zod conversion (enhanced: enums, formats, length, pattern, numeric bounds, arrays, unions, allOf, nullable, defaults partial)
- Generated endpoint tools from OpenAPI (filters supported)
- Summarize JSON tool (model-assisted when available)
- Progressive streaming with chunk + periodic progress events & previews
 - Debounced tool/resource/prompt list change notifications
 - Stateless HTTP mode (per-request ephemeral init) & SSE fallback route `/mcp/events`
- Interactive echo tool with elicitation fallback
- Basic resource registry (openapi_schema, endpoint_index) and tools to list/get
- Basic prompt registry (endpoint_help) and tools to list/run
- Argument completion tool (paths, methods, discriminator values)
 - OAuth proxy (dynamic client registration + token exchange) when protected mode enabled
 - DNS rebinding protection (Host + remote address allowlist)
 - Resource hash change detection with granular changed[] list in notifications
 - Expanded JSON Schema formats (date, time, ipv4, ipv6, hostname, byte, binary placeholder)
 - Endpoint_* dynamic resources (per operation detail)
 - Sampling helpers (_summarize_json with model, _sample generic retries/backoff)

## Partial / In Progress
 - Full discriminator & composed schema handling (advanced polymorphism)
 - Rich prompt templating & variable schema validation
 - Tool schema hot update (beyond enable/disable/remove)

## Planned / Not Yet Implemented
 - Full SSE multiplexing optimizations
 - Enhanced auth router with PKCE flow management
 - Advanced sampling orchestration (multiple model strategies)
 - Debounced batching for resource/prompt granular diffs
 - Documentation generation automation

## Notes
Some SDK methods described in early design docs (e.g., direct registerResource/registerPrompt) were not present; in-memory fallback registries added with tool accessors. Upgrade to native APIs when available.
