---
id: sampling
title: Sampling Helpers
sidebar_label: Sampling
---

# Sampling Helpers

Sampling helpers expose curated subsets or transformations of prior responses / schemas to aid model prompting, summarization, and test generation.

## Goals
- Avoid re-transmitting large raw responses in each prompt.
- Provide deterministic, cacheable slices.
- Support progressive enrichment (body → summary → embeddings later).

## Core Helper Tools
| Tool | Purpose |
| ---- | ------- |
| `_sample_response_body` | Capture and persist last response body for an operation id. |
| `_sample_summarize_json` | Summarize captured JSON (delegates to `summarize_json` when available). |
| `_sample_list` | Enumerate stored samples & metadata. |

(Names may be prefixed per collision / naming mode.)

## Workflow Example
1. Call endpoint tool `getUser` (streaming or not).
2. Invoke `_sample_response_body` with `{ operationId: "getUser" }`.
3. Invoke `_sample_summarize_json` to produce a compact summary resource.
4. Client fetches resource `sample_response_getUser` or `sample_summary_getUser` by name for inclusion elsewhere.

## Storage & Resources
Each sample materializes as a resource with a stable name (`sample_response_<op>`). Hash-based change notifications allow clients to refresh selectively.

## Summarization Fallback
If summarization model/tool unavailable, summary helper returns truncated JSON (size-limited) ensuring deterministic output.

## Progressive Streaming Synergy
Sampling tools can operate even when original response was chunk-streamed; body assembly is performed during streaming with digest validation before storing.

## Roadmap
- Embedding generation (`_sample_embed_json`)
- Multi-sample aggregation & schema diffing
- Token-aware prompt chunking

Next: [Resources & Prompts](resources-prompts.md) or [Streaming Responses](streaming-responses.md).
