import fs from 'fs/promises';
import path from 'path';
import crypto from 'node:crypto';

export interface CredentialRecord { [scheme: string]: any }
export interface CredentialStore {
  load(): Promise<CredentialRecord>;
  save(creds: CredentialRecord): Promise<void>;
}

export class MemoryCredentialStore implements CredentialStore {
  private data: CredentialRecord = {};
  async load(): Promise<CredentialRecord> { return { ...this.data }; }
  async save(creds: CredentialRecord): Promise<void> { this.data = { ...creds }; }
}

export interface FileCredentialStoreOptions { filePath?: string; keyHex?: string | null; }

export class FileCredentialStore implements CredentialStore {
  private file: string;
  private key: Buffer | null;
  constructor(opts: FileCredentialStoreOptions = {}) {
    const cwd = process.cwd();
    // Preferred new location (renamed): .oas_mcps/creds.json. Migration from legacy
    // Legacy 1: .mcp/creds.json (previous directory name)
    // Legacy 2: .mcp-credentials.json (original single-file flat layout)
    const newDir = path.resolve(cwd, '.oas_mcps');
    const newFile = path.join(newDir, 'creds.json');
    const legacyDirFile = path.resolve(cwd, '.mcp/creds.json');
    const legacyFlatFile = path.resolve(cwd, '.mcp-credentials.json');
    let chosen = newFile;
    if (opts.filePath) {
      chosen = path.resolve(cwd, opts.filePath);
    } else {
      try {
        const fsSync = require('fs');
        const newExists = fsSync.existsSync(newFile);
        const legacyDirExists = fsSync.existsSync(legacyDirFile);
        const legacyFlatExists = fsSync.existsSync(legacyFlatFile);
        if (!newExists) {
          // Auto-migrate: prefer directory legacy, then flat legacy
          const fsSync2 = require('fs');
          if (legacyDirExists) {
            try { fsSync2.mkdirSync(newDir, { recursive: true }); } catch {/* ignore */}
            try { fsSync2.copyFileSync(legacyDirFile, newFile); } catch {/* ignore copy */}
          } else if (legacyFlatExists) {
            try { fsSync2.mkdirSync(newDir, { recursive: true }); } catch {/* ignore */}
            try { fsSync2.copyFileSync(legacyFlatFile, newFile); } catch {/* ignore copy */}
          }
        }
      } catch {/* ignore detection/migration errors */}
    }
    if (!opts.filePath) {
      // Ensure new directory exists synchronously to avoid race on first save
      try {
        const fsSync3 = require('fs');
        fsSync3.mkdirSync(newDir, { recursive: true });
      } catch {/* ignore */}
    }
    this.file = chosen; // chosen may still be custom path override
    this.key = opts.keyHex ? deriveKey(opts.keyHex) : null;
  }
  async load(): Promise<CredentialRecord> {
    try {
      const raw = await fs.readFile(this.file);
      if (!raw.length) return {};
      let jsonBuf = raw;
      // Encrypted file starts with 'enc:' marker
      if (raw.slice(0,4).toString() === 'enc:') {
        if (!this.key) return {}; // can't decrypt without key
        const payload = raw.slice(4); // skip marker
        jsonBuf = decryptBlob(payload, this.key);
      }
      const text = jsonBuf.toString('utf8');
      return JSON.parse(text);
    } catch (e: any) {
      if (e.code === 'ENOENT') return {}; // first run
      return {}; // fail closed (empty)
    }
  }
  async save(creds: CredentialRecord): Promise<void> {
    const json = JSON.stringify(creds, null, 2);
    if (this.key) {
      const enc = encryptText(json, this.key);
      const out = Buffer.concat([Buffer.from('enc:'), enc]);
      try { await fs.writeFile(this.file, out); }
      catch (e:any) {
        if (e.code === 'ENOENT') {
          // Attempt to create parent directory then retry once
          try { const dir = path.dirname(this.file); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(this.file, out); return; } catch {/* fall through */}
        }
        throw e;
      }
    } else {
      try { await fs.writeFile(this.file, json, 'utf8'); }
      catch (e:any) {
        if (e.code === 'ENOENT') {
          try { const dir = path.dirname(this.file); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(this.file, json, 'utf8'); return; } catch {/* ignore */}
        }
        throw e;
      }
    }
  }
}

function deriveKey(keyHex: string): Buffer {
  const clean = keyHex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean)) throw new Error('MCP_CRED_KEY must be hex');
  if (![32,48,64].includes(clean.length)) throw new Error('MCP_CRED_KEY must be 16/24/32 bytes hex (32/48/64 chars)');
  return Buffer.from(clean, 'hex');
}

function encryptText(plain: string, key: Buffer): Buffer {
  // Use AES-256-GCM; adapt key length (node can accept 16/24/32 bytes for aes-128/192/256)
  const algo = key.length === 16 ? 'aes-128-gcm' : key.length === 24 ? 'aes-192-gcm' : 'aes-256-gcm';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algo, key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]); // iv(12) + tag(16) + ciphertext
}

function decryptBlob(blob: Buffer, key: Buffer): Buffer {
  if (blob.length < 12+16) throw new Error('Encrypted blob too short');
  const algo = key.length === 16 ? 'aes-128-gcm' : key.length === 24 ? 'aes-192-gcm' : 'aes-256-gcm';
  const iv = blob.subarray(0,12);
  const tag = blob.subarray(12, 28);
  const data = blob.subarray(28);
  const decipher = crypto.createDecipheriv(algo, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec;
}

export function buildCredentialStore(mode: 'memory' | 'file' | undefined): CredentialStore {
  if (mode === 'file') {
    const keyHex = process.env.MCP_CRED_KEY || null;
    const filePath = process.env.MCP_CRED_FILE;
    return new FileCredentialStore({ keyHex, filePath });
  }
  return new MemoryCredentialStore();
}
