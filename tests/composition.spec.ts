import { describe, it, expect } from 'vitest';
import { loadAndParseOpenAPI } from '../src/openapi/parser.js';

const baseSpec = (schemaSection: string) => `openapi: 3.0.0
info:
  title: Test
  version: 1.0.0
paths:
  /test:
    post:
      requestBody:
        content:
          application/json:
            schema:
${schemaSection.split('\n').map(l=>'              '+l).join('\n')}
      responses:
        '200': { description: OK }
`;

describe('Schema composition', () => {
  it('merges simple allOf object properties', async () => {
    const spec = baseSpec(`              allOf:
                - type: object
                  properties: { a: { type: string } }
                  required: [a]
                - type: object
                  properties: { b: { type: number } }
                  required: [b]
`);
    const parsed = await loadAndParseOpenAPI(spec);
    const ep = parsed.endpoints[0];
    const schema: any = ep.requestBody?.content['application/json'].schema;
    expect(schema._mergedAllOf).toBe(true);
    expect(Object.keys(schema.properties||{})).toEqual(['a','b']);
    expect(schema.required?.sort()).toEqual(['a','b']);
  });
  it('retains oneOf variants', async () => {
    const spec = baseSpec(`              oneOf:
                - type: object
                  properties: { x: { type: string } }
                - type: object
                  properties: { y: { type: integer } }
`);
    const parsed = await loadAndParseOpenAPI(spec);
    const ep = parsed.endpoints[0];
    const schema: any = ep.requestBody?.content['application/json'].schema;
    expect(schema.oneOf).toBeTruthy();
    expect(schema.oneOf.length).toBe(2);
  });
  it('retains anyOf variants', async () => {
    const spec = baseSpec(`              anyOf:
                - type: object
                  properties: { a: { type: string } }
                - type: object
                  properties: { b: { type: string } }
`);
    const parsed = await loadAndParseOpenAPI(spec);
    const ep = parsed.endpoints[0];
  const schema: any = ep.requestBody?.content['application/json'].schema;
    expect(schema.anyOf).toBeTruthy();
    expect(schema.anyOf.length).toBe(2);
  });
  it('does not merge conflicting allOf', async () => {
    const spec = baseSpec(`              allOf:
                - type: object
                  properties: { a: { type: string } }
                - type: object
                  properties: { a: { type: number } }
`);
    const parsed = await loadAndParseOpenAPI(spec);
    const ep = parsed.endpoints[0];
    const schema: any = ep.requestBody?.content['application/json'].schema;
    expect(schema._mergedAllOf).not.toBe(true); // conflict prevents merge
  });
});
