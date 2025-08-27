#!/usr/bin/env node
import { readdir, readFile, access } from 'fs/promises';
import { join, dirname } from 'path';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const docsDir = join(__dirname, '..', 'docs');

async function collect(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await collect(full, out);
    else if (e.isFile() && e.name.endsWith('.md')) out.push(full);
  }
}
const mdFiles = [];
await collect(docsDir, mdFiles);

let broken = 0;
for (const file of mdFiles) {
  const content = await readFile(file, 'utf8');
  const links = [...content.matchAll(/\[(?:[^\]]+)\]\(([^)]+)\)/g)].map(m => m[1]);
  for (const raw of links) {
    const l = raw.trim();
    if (!l) continue;
    if (l.startsWith('http://') || l.startsWith('https://') || l.startsWith('#')) continue;
    if (l.startsWith('../')) continue; // outside docs root
    if (l.startsWith('/')) continue; // site-absolute (let Docusaurus handle)
    const targetNoHash = l.split('#')[0];
    if (!targetNoHash.endsWith('.md')) continue; // only validate md
    const baseDir = dirname(file);
    const candidate = join(baseDir, targetNoHash);
    try {
      await access(candidate);
    } catch {
      // also try relative to docs root
      try {
        await access(join(docsDir, targetNoHash));
      } catch {
        console.error(`Broken link in ${file}: ${l}`);
        broken++;
      }
    }
  }
}

if (broken) {
  console.error(`\nLink check failed: ${broken} broken link(s).`);
  process.exit(1);
}
console.log('All internal markdown links OK.');
