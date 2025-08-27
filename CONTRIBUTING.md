# Contributing Guide

Thanks for your interest in improving OAS-MCP! This guide outlines how to set up your environment, make changes, and submit high‑quality pull requests.

## Table of Contents
1. Philosophy
2. Project Layout
3. Getting Started
4. Development Workflow
5. Commit Style
6. Testing
7. Linting & Formatting
8. Pull Request Checklist
9. Release Process
10. Security

## 1. Philosophy
Keep the public API stable (as exported from `src/index.ts`). Internals may evolve but prefer incremental, well‑scoped changes backed by tests. Favor readability over cleverness; document non-obvious edge cases.

## 2. Project Layout
```
src/               Source (server, tools, openapi parsing, utilities)
tests/             Vitest specs (one logical concern per file)
frontend/          (Dev) React UI for building connection URLs (not published)
vitest.config.ts   Test runner configuration
```

## 3. Getting Started
```bash
git clone <repo>
cd oas-mcp
npm install
npm test
```
Run dev server:
```bash
npm run dev -- serve --port 8080 --allow-file
```

## 4. Development Workflow
1. Open/assign an issue (or create one) describing the change.
2. Create a feature branch: `feat/<short-topic>` or `fix/<short-topic>`.
3. Add/update tests first when feasible.
4. Keep PRs focused (< ~400 lines diff preferred). Split large refactors.
5. Ensure CI (lint, typecheck, test, build) passes.

## 5. Commit Style
Conventional prefix recommended but not enforced:
```
feat: short summary
fix: resolve parsing bug in discriminator mapping
docs: update README metrics section
refactor: extract metrics module
test: add failing case for oauth refresh
chore: bump dependency
build: adjust tsconfig for declaration bundling
ci: update release workflow
```
Use present tense, no trailing period. Squash trivial fixup commits locally when possible.

## 6. Testing
Use Vitest. Add a dedicated spec or extend an existing closely related one. Avoid brittle timing assumptions—use deterministic stubs where possible.
Run full suite:
```bash
npm test
```

## 7. Linting & Formatting
```bash
npm run lint
npm run format
```
CI enforces both; fix warnings or justify exceptions with comments.

## 8. Pull Request Checklist
- [ ] Issue linked / explained
- [ ] Tests added / updated; suite green
- [ ] Lint & typecheck pass locally
- [ ] Public API unchanged or documented
- [ ] No unrelated formatting churn

## 9. Release Process
Maintainers:
1. Bump version in `package.json` following semver (still 0.x: minor for features, patch for fixes).
2. Commit with `chore: release v0.x.y` & tag `v0.x.y`.
3. Push branch + tag; GitHub Actions `release.yml` publishes (requires `NPM_TOKEN`).
4. Draft release notes summarizing key changes & security fixes.

## 10. Security
See `SECURITY.md` for vulnerability reporting. Never include POC exploit details in a public PR before a fix is released.

## 11. Code of Conduct
Participation is governed by `CODE_OF_CONDUCT.md`.

---
Thanks for contributing!
