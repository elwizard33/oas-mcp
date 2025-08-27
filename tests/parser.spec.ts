import { describe, it, expect } from 'vitest';
import { loadAndParseOpenAPI } from '../src/openapi/parser.js';

const sample = `openapi: 3.0.0\ninfo:\n  title: T\n  version: 1.0.0\npaths:\n  /ping:\n    get:\n      summary: Ping op\n`;

describe('OpenAPI parser', () => {
  it('parses basic YAML spec', async () => {
    const parsed = await loadAndParseOpenAPI(sample);
    expect(parsed.endpoints.length).toBe(1);
    expect(parsed.endpoints[0].method).toBe('GET');
  });
});
