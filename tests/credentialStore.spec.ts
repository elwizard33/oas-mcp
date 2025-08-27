import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryCredentialStore, FileCredentialStore } from '../src/cred/store.js';
import fs from 'fs/promises';
import path from 'path';

describe('Credential Stores', () => {
  describe('MemoryCredentialStore', () => {
    it('persists within instance', async () => {
      const store = new MemoryCredentialStore();
      await store.save({ apiKey: { value: 'secret' } });
      const loaded = await store.load();
      expect(loaded.apiKey.value).toBe('secret');
    });
    it('is isolated between instances', async () => {
      const a = new MemoryCredentialStore();
      const b = new MemoryCredentialStore();
      await a.save({ token: { value: 't1' } });
      const loadedB = await b.load();
      expect(loadedB.token).toBeUndefined();
    });
  });

  describe('FileCredentialStore', () => {
    const tmpDir = path.resolve(process.cwd(), 'tmp-test-creds');
    const filePath = path.join(tmpDir, 'creds.json');
    beforeEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
      await fs.mkdir(tmpDir, { recursive: true });
    });

    it('saves and loads plaintext when no key', async () => {
      const store = new FileCredentialStore({ filePath });
      await store.save({ bearer: { token: 'abc' } });
      const raw = await fs.readFile(filePath, 'utf8');
      expect(raw).toContain('abc');
      const loaded = await store.load();
      expect(loaded.bearer.token).toBe('abc');
    });

    it('saves and loads encrypted when key provided', async () => {
      const keyHex = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 32 bytes
      const store = new FileCredentialStore({ filePath, keyHex });
      await store.save({ oauth: { accessToken: 'sekret' } });
      const raw = await fs.readFile(filePath);
      expect(raw.slice(0,4).toString()).toBe('enc:');
      expect(raw.toString()).not.toContain('sekret');
      const loaded = await store.load();
      expect(loaded.oauth.accessToken).toBe('sekret');
    });
  });
});
