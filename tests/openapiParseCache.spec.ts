import { describe, it, expect } from 'vitest';
import { loadAndParseOpenAPI } from '../src/openapi/parser.js';

const SIMPLE_SPEC = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Demo', version: '1.0.0' },
  paths: { '/ping': { get: { summary: 'Ping' } } }
});

describe('OpenAPI Parse Cache', () => {
  it('returns same object reference on second parse when cache enabled', async () => {
    delete process.env.OASMCP_CACHE; // ensure default (enabled)
    const a = await loadAndParseOpenAPI(SIMPLE_SPEC);
    const b = await loadAndParseOpenAPI(SIMPLE_SPEC);
    expect(a).toBe(b); // identity reuse indicates cache hit
  });

  it('returns different object when cache disabled', async () => {
    process.env.OASMCP_CACHE = '0';
    const a = await loadAndParseOpenAPI(SIMPLE_SPEC);
    const b = await loadAndParseOpenAPI(SIMPLE_SPEC);
    expect(a).not.toBe(b);
  });
});
