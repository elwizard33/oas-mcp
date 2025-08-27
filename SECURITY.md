# Security Policy

## Supported Versions

| Version | Supported | Notes |
|---------|-----------|-------|
| 0.x     | ✅ (Latest minor only) | Breaking changes may occur between minors until 1.0. |

Only the most recent published 0.x version receives security fixes. Please upgrade promptly after releases.

## Reporting a Vulnerability

1. Email: security@example.com (replace with project email or maintainer alias).
2. Provide: description, affected versions, reproduction steps / PoC, potential impact, suggested remediation (if known).
3. Expect initial acknowledgement within 72 hours and a status update within 7 days.

Please do NOT open public issues for potential vulnerabilities until a fix is released.

## Disclosure Process

1. Triage & reproduce.
2. Assess severity (CVSS-style internal scoring).
3. Prepare patch + regression tests.
4. Coordinate a release (may batch with other fixes if low severity).
5. Publish advisory in release notes (and GH Security Advisory if repository is public on GitHub).

## Handling Sensitive Data

This project does not itself store end-user secrets server-side unless configured to use the file credential store. When using the file credential store:
* Optionally enable encryption via `MCP_CRED_KEY` (32-byte hex for AES-256-GCM).
* Ensure file permissions restrict access to the running user.

## Recommendations for Operators

* Run behind a reverse proxy with network egress controls to mitigate SSRF attempts.
* Configure an allowlist for outbound API domains if available (feature already enforces domain policy). 
* Keep dependencies updated.
* Monitor for anomalous request volume; rate limiting here is per-tool only.

## Cryptography Notice

Credential encryption (if enabled) uses AES-256-GCM with a user-supplied random key. Ensure high-entropy keys; rotate if compromise suspected.

## Contact

For clarifications, use the security email above. For non-security issues, open a standard GitHub issue.
