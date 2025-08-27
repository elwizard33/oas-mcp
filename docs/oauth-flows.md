---
id: oauth-flows
title: Guide: OAuth Flows
sidebar_label: OAuth Flows
---

# Guide: OAuth Flows

Related: [Adding Credentials](adding-credentials.md), [Authentication & Credentials](authentication-credentials.md), [Credential Store](credential-store.md)

## Client Credentials
Call configure + fetch tool; token auto-refreshes.

## Device Code
1. Start tool → returns user_code & verification_uri.
2. Poll tool until token stored.

## Auth Code (PKCE)
1. Generate authorize URL (tool output includes state & code verifier).
2. User completes consent → obtain code.
3. Exchange code via tool → stores access & refresh tokens.

## Refresh
Automatic if refresh_token present else client credential logic.

Troubleshooting:
| Issue | Action |
| ----- | ------ |
| No token after poll | Interval too short; respect `slow_down` | 
| 401 after refresh | Refresh silently failed → reconfigure |

Next: [Multipart & File Uploads](multipart-file-uploads.md).
