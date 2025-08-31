---
id: credential-store
title: "Advanced: Credential Store"
sidebar_label: Credential Store
---

# Advanced: Credential Store

Related: [Authentication & Credentials](authentication-credentials.md), [Adding Credentials](adding-credentials.md), [Security](security.md)

Modes:
- `memory`: ephemeral
- `file`: persisted JSON (optionally AES-GCM encrypted if `MCP_CRED_KEY` set)

Encryption: Key read as hex → 32 bytes. Nonce random per save. Auth tag stored alongside. Failure to decrypt aborts load (store ignored until replaced).

Rotation: Write new key, re-run set tools (re-encrypts future saves). Optionally export & re-import credentials via `_auth_list_credentials` plus individual set tools (values not exposed, so manual secure source required).

Environment Import: On first initialization, any env vars matching `OAS_MCP_<SCHEME>_<ID>` populate missing credentials (never overwrite existing). Examples: `OAS_MCP_apiKey_default=abc`, `OAS_MCP_basic_service=user:pass`.

Next: [Schema Composition & Discriminators](schema-composition-discriminators.md).
