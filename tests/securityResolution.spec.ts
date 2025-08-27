import { describe, it, expect } from 'vitest';
import { loadAndParseOpenAPI } from '../src/openapi/parser.js';

const spec = `openapi: 3.0.0
info: { title: SecOps, version: 1.0.0 }
security:
  - ApiKeyHeader: []
  - BearerAuth: []
components:
  securitySchemes:
    ApiKeyHeader:
      type: apiKey
      in: header
      name: X-API-Key
    BearerAuth:
      type: http
      scheme: bearer
paths:
  /public:
    get:
      security: [] # disable auth
  /inherited:
    get: {}
  /override:
    get:
      security:
        - BearerAuth: []
        - ApiKeyHeader: []
`;

describe('Per-operation security resolution', () => {
  it('resolves inheritance, override, and disable cases', async () => {
    const parsed = await loadAndParseOpenAPI(spec);
    const byPath: any = Object.fromEntries(parsed.endpoints.map(ep => [ep.path+':'+ep.method, ep]));
    expect(byPath['/public:GET'].security).toEqual([]); // disabled
    // inherited: should equal root security (two requirement objects OR)
    expect(byPath['/inherited:GET'].security?.length).toBe(2);
    // override: two requirement objects OR order as specified
    const override = byPath['/override:GET'].security;
    expect(override?.length).toBe(2);
    expect(Object.keys(override[0])[0]).toBe('BearerAuth');
  });
});
