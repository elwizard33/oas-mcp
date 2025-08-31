---
id: resources-prompts
title: Resources & Prompts Registry
sidebar_label: Resources & Prompts
---

# Resources & Prompts Registry

The server exposes a dynamic registry for surfacing structured artifacts to MCP clients without embedding them in tool results repeatedly.

## Concepts
- Resource: Named content blob (JSON/text) addressable by name.
- Prompt: Template-like entry with optional metadata fields (future expansion).
- Emission: Listed via `resources/list` (MCP protocol) and incremental updates via `resources/list_changed`.

## Change Notifications
A debounced watcher computes SHA256 hashes per resource; on change it emits `resources/list_changed` with:
```json
{
  "changed": ["endpoint_getUser", "spec_summary"],
  "resources": [ {"name": "endpoint_getUser", "mimeType": "application/json"} ]
}
```
Clients can selectively re-fetch only the `changed` names.

## Endpoint Resource Emulation
Every generated endpoint tool also has a sibling resource (prefixed `endpoint_`) containing:
- Method / path summary
- Input parameter schema digest
- Last generation timestamp

Useful for building dynamic UI lists without calling each tool.

## Sampling Integration
Sampling helper tools (see [Sampling Helpers](sampling.md)) produce derived resources (e.g. `sample_response_<op>`). The registry ensures subsequent calls reference existing artifacts instead of duplicating data.

## Prompts
Currently lightweight placeholders; early clients may ignore. Future: model-specific templating or chain configuration.

## Accessing Resources
Use standard MCP resource fetch patterns (client dependent). Hash changes allow cache revalidation; unchanged resources can be skipped.

Next: [Sampling Helpers](sampling.md).
