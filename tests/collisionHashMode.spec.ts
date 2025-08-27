import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const specWithCollisions = {
  openapi: '3.0.0',
  info: { title: 'Collision', version: '1.0.0' },
  paths: {
    '/Thing': { get: { summary: 'A' } },
    '/thing': { get: { summary: 'B' } }
  }
};

const params: any = {
  baseURL: 'https://api.example.com',
  schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(specWithCollisions)),
  filters: [],
  nameCollisionMode: 'hash'
};

describe('Tool name collision handling (hash mode)', () => {
  it('appends stable 6-char hash for duplicate sanitized names', async () => {
    // mock fetch
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({'content-type':'application/json'}), text: () => Promise.resolve('{}'), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) });
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const names = server.listTools().map(t => t.name);
    const base = names.find(n => /get_thing$/.test(n));
    expect(base).toBeTruthy();
    const hashed = names.filter(n => /get_thing_[0-9a-f]{6}$/.test(n));
    expect(hashed.length).toBe(1);
    // Ensure no numeric _2 suffix when in hash mode
    const suffixed = names.filter(n => /get_thing_2$/.test(n));
    expect(suffixed.length).toBe(0);
  });
});
