---
id: credential-store
title: Advanced: Credential Store
sidebar_label: Credential Store
---

# Advanced: Credential Store

Related: [Authentication & Credentials](authentication-credentials.md), [Adding Credentials](adding-credentials.md), [Security](security.md)

Modes:
- `memory`: ephemeral
- `file`: persisted JSON (optionally AES-GCM encrypted if `MCP_CRED_KEY` set)

Encryption: Key read as hex → 32 bytes. Nonce random per save. Auth tag stored alongside.

Rotation: Write new key, re-run set tools (re-encrypts future saves).

Next: [Schema Composition & Discriminators](schema-composition-discriminators.md).
