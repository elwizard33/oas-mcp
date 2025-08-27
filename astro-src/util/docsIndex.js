import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(__dirname, '../../docs');

function collectFiles(dir){
  const entries = fs.readdirSync(dir, { withFileTypes:true });
  let files = [];
  for(const e of entries){
    if(e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if(e.isDirectory()) files = files.concat(collectFiles(full));
    else if(/\.md$/i.test(e.name)) files.push(full);
  }
  return files;
}

function parseFrontmatter(content){
  if(content.startsWith('---')){
    const end = content.indexOf('\n---',3);
    if(end!==-1){
      const fmRaw = content.slice(3,end).trim();
      const body = content.slice(end+4);
      const frontmatter = {};
      for(const line of fmRaw.split(/\r?\n/)){
        const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if(m) frontmatter[m[1]] = m[2];
      }
      return { frontmatter, body };
    }
  }
  return { frontmatter:{}, body:content };
}

const files = collectFiles(docsRoot);
const docs = files.map(f=>{
  const rel = path.relative(docsRoot, f).replace(/\\/g,'/');
  const raw = fs.readFileSync(f,'utf8');
  const { frontmatter, body } = parseFrontmatter(raw);
  const html = marked.parse(body);
  const baseSlug = rel.replace(/\.md$/,'');
  return { slug: baseSlug === 'overview' ? 'overview' : baseSlug, rel, frontmatter, html };
}).sort((a,b)=> a.slug.localeCompare(b.slug));

// Grouping similar to prior Docusaurus categories.
const categories = [
  { name: 'Introduction', match: ['overview','quick-start'] },
  { name: 'Getting Started', match: ['installation','cli-usage','frontend-ui','configuration'] },
  { name: 'Core Concepts', match: ['openapi-parsing-caching','endpoint-tool-generation','authentication-credentials','rate-limiting','retry-policy','streaming-responses','metrics','security'] },
  { name: 'Guides', match: ['adding-credentials','oauth-flows','multipart-file-uploads','query-param-styles','handling-large-binary','filtering-endpoints'] },
  { name: 'API Reference', match: docs.filter(d=>d.slug.startsWith('api/')).map(d=>d.slug) },
  { name: 'Advanced Topics', match: ['name-collision-modes','credential-store','schema-composition-discriminators','streaming-event-contract'] },
  { name: 'Contributing', match: ['development-setup','architecture-overview'] },
  { name: 'Changelog', match: ['changelog-link'] }
];

const sidebar = [];
for(const cat of categories){
  const items = [];
  for(const slug of cat.match){
    const doc = docs.find(d=>d.slug===slug);
    if(doc) items.push({ label: doc.frontmatter.title || slug, href: `/oas-mcp/${doc.slug}` });
  }
  if(items.length){
    sidebar.push({ label: cat.name, href: items[0].href, group: items });
  }
}


export default { docs, sidebar };
