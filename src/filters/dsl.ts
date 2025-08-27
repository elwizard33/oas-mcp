export interface PathFilter {
  pattern: string;
  methods: string[]; // upper-case
  exclude: boolean;
}

export function parseFilterDSL(dsl: string): PathFilter[] {
  if (!dsl) return [];
  const expressions = dsl.split(';').map(s => s.trim()).filter(Boolean);
  const filters: PathFilter[] = [];
  for (const exprRaw of expressions) {
    let expr = exprRaw;
    let include = true;
    if (expr.startsWith('+')) { include = true; expr = expr.slice(1); }
    else if (expr.startsWith('-')) { include = false; expr = expr.slice(1); }
    const [patternPart, methodsPart] = expr.split(':');
    const methods = methodsPart ? methodsPart.split(/\s+/).map(m => m.toUpperCase()).filter(Boolean) : [];
    filters.push({ pattern: patternPart, methods, exclude: !include });
  }
  return filters;
}

export function matchGlob(pattern: string, path: string): boolean {
  if (pattern === '*' || pattern === '**') return true;
  const patternSegs = trimSlashes(pattern).split('/').filter(Boolean);
  const pathSegs = trimSlashes(path).split('/').filter(Boolean);
  return matchSegments(patternSegs, pathSegs);
}

function trimSlashes(s: string) { return s.replace(/^\/+|\/+$|\s+/g, match => match.startsWith('/') ? '' : ''); }

function matchSegments(pattern: string[], path: string[]): boolean {
  if (pattern.length === 0) return path.length === 0;
  if (pattern[0] === '**') {
    if (matchSegments(pattern.slice(1), path)) return true;
    if (path.length > 0) return matchSegments(pattern, path.slice(1));
    return false;
  }
  if (path.length === 0) return false;
  if (pattern[0] === '*' || pattern[0] === path[0]) return matchSegments(pattern.slice(1), path.slice(1));
  return false;
}

export function shouldInclude(path: string, method: string, filters: PathFilter[]): boolean {
  if (!filters.length) return true;
  const hasInclude = filters.some(f => !f.exclude);
  let included = hasInclude ? false : true;
  if (hasInclude) {
    for (const f of filters) {
      if (!f.exclude && matchGlob(f.pattern, path) && methodMatches(f, method)) { included = true; break; }
    }
  }
  for (const f of filters) {
    if (f.exclude && matchGlob(f.pattern, path) && methodMatches(f, method)) { included = false; break; }
  }
  return included;
}

function methodMatches(f: PathFilter, method: string) {
  if (!f.methods.length) return true;
  return f.methods.includes(method.toUpperCase());
}
