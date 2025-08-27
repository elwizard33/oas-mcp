export function sanitizeToolName(name: string): string {
  let s = name.toLowerCase();
  const replacements: [RegExp, string][] = [
    [/\s+/g, '_'],
    [/-/g, '_'],
    [/\//g, '_'],
    [/\./g, '_'],
    [/\{/g, ''],
    [/\}/g, ''],
    [/:/g, '_'],
    [/\?/g, ''],
    [/&/g, 'and'],
    [/=/g, '_eq_'],
    [/%/g, '_pct_']
  ];
  for (const [pattern, r] of replacements) s = s.replace(pattern, r);
  while (s.includes('__')) s = s.replace(/__/g, '_');
  s = s.replace(/^_+/, '').replace(/_+$/, '');
  return s || 'unnamed_tool';
}
