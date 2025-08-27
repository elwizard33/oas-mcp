import { sha256Hex } from '../util/hash.js';
import { ParsedSpec } from './parser.js';

interface Entry { key: string; value: ParsedSpec; }

/** Simple size-bounded LRU cache keyed by sha256(rawSpec). */
export class OpenAPICache {
  private map = new Map<string, Entry>();
  constructor(private maxSize = 8) {}

  get(raw: string): ParsedSpec | undefined {
    const k = sha256Hex(raw);
    const hit = this.map.get(k);
    if (!hit) return undefined;
    // refresh recency
    this.map.delete(k);
    this.map.set(k, hit);
    return hit.value;
  }

  set(raw: string, value: ParsedSpec) {
    const k = sha256Hex(raw);
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, { key: k, value });
    if (this.map.size > this.maxSize) {
      // evict LRU (first inserted)
      const first = this.map.keys().next();
      if (!first.done) this.map.delete(first.value);
    }
  }
}

// Singleton default cache (opt-in via env var unless explicitly disabled)
export const openapiCache = new OpenAPICache();

export function shouldUseCache(): boolean {
  const flag = process.env.OASMCP_CACHE;
  if (flag === '0' || flag === 'false') return false;
  // default: enabled unless explicitly off
  return true;
}
