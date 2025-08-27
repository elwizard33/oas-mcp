---
id: schema-composition-discriminators
title: Advanced: Schema Composition & Discriminators
sidebar_label: Schema Composition & Discriminators
---

# Advanced: Schema Composition & Discriminators

Related: [OpenAPI Parsing & Caching](openapi-parsing-caching.md), [Endpoint Tool Generation](endpoint-tool-generation.md)

`allOf` merge: object-only, conflict-free -> properties union + required union (`xMergedAllOf: true`).

`oneOf` / `anyOf`: summarized list (type/description subset) for requestBody display.

Discriminator: surfaced as `xDiscriminator` with mapping keys and mapping object.

Next: [Streaming Event Contract](streaming-event-contract.md).
