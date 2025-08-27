---
id: filtering-endpoints
title: "Guide: Filtering Endpoints"
sidebar_label: Filtering Endpoints
---

# Guide: Filtering Endpoints

Related: [Configuration](configuration.md) (filters param), [Endpoint Tool Generation](endpoint-tool-generation.md)

Filter expressions accepted via `filters` query parameter (comma or semicolon separated). Examples:

| Expression | Meaning |
| ---------- | ------- |
| `method:GET` | Include only GET |
| `path:/users/*` | Include user paths |
| `!path:/internal/*` | Exclude internal paths |

Combination logic: All includes ORed; exclusions applied last.

Next: [Name Collision Modes](name-collision-modes.md).
