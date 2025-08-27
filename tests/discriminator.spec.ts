import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

// Spec with a discriminator for a Pet type
const spec = {
  openapi: '3.0.0',
  info: { title: 'Discriminator Test', version: '1.0.0' },
  paths: {
    '/pets': {
      post: {
        summary: 'Create pet',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                oneOf: [
                  { type: 'object', properties: { petType: { type: 'string' }, name: { type: 'string' }, huntingSkill: { type: 'string' } }, required: ['petType','name'], description: 'Cat' },
                  { type: 'object', properties: { petType: { type: 'string' }, name: { type: 'string' }, packSize: { type: 'integer' } }, required: ['petType','name'], description: 'Dog' }
                ],
                discriminator: {
                  propertyName: 'petType',
                  mapping: {
                    cat: '#/components/schemas/Cat',
                    dog: '#/components/schemas/Dog'
                  }
                }
              }
            }
          }
        },
        responses: { '200': { description: 'OK' } }
      }
    }
  }
};

const params: any = {
  baseURL: 'https://api.example.com',
  schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)),
  filters: []
};

describe('Discriminator parsing & exposure', () => {
  it('surfaces xDiscriminator metadata on requestBody schema', async () => {
    // mock fetch
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: () => Promise.resolve('{}'), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tool = server.listTools().find(t => t.name.endsWith('_post_pets'))!;
    expect(tool).toBeTruthy();
    const inputSchema: any = tool.input;
    const rb = inputSchema?.properties?.requestBody;
    expect(rb).toBeTruthy();
    expect(rb.xDiscriminator).toBeTruthy();
    if (rb.xDiscriminator) {
      expect(rb.xDiscriminator.propertyName).toBe('petType');
      expect(rb.xDiscriminator.mappingKeys).toEqual(['cat','dog']);
      expect(rb.xDiscriminator.mapping.dog).toContain('Dog');
    }
  });
});
