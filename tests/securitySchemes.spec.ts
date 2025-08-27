import { describe, it, expect } from 'vitest';
import { loadAndParseOpenAPI } from '../src/openapi/parser.js';

const spec = `openapi: 3.0.0
info: { title: Sec, version: 1.0.0 }
components:
  securitySchemes:
    ApiKeyHeader:
      type: apiKey
      in: header
      name: X-API-Key
    ApiKeyQuery:
      type: apiKey
      in: query
      name: api_key
    BasicAuth:
      type: http
      scheme: basic
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    OAuth2CC:
      type: oauth2
      flows:
        clientCredentials:
          tokenUrl: https://auth.example.com/token
          scopes:
            read: Read access
paths: {}
`;

describe('Security scheme parsing', () => {
  it('extracts and normalizes security schemes', async () => {
    const parsed = await loadAndParseOpenAPI(spec);
    const ss = parsed.securitySchemes!;
    expect(ss.ApiKeyHeader).toMatchObject({ type: 'apiKey', in: 'header', name: 'X-API-Key' });
    expect(ss.ApiKeyQuery).toMatchObject({ type: 'apiKey', in: 'query', name: 'api_key' });
    expect(ss.BasicAuth).toMatchObject({ type: 'http', scheme: 'basic' });
    expect(ss.BearerAuth).toMatchObject({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' });
    expect(ss.OAuth2CC?.flows?.clientCredentials?.tokenUrl).toBe('https://auth.example.com/token');
  });
});
