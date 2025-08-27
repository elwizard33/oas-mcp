import SwaggerParser from '@apidevtools/swagger-parser';

// Simple wrapper to fully dereference an OpenAPI document string.
// Falls back to raw parse if dereference fails.
export async function dereference(raw: string): Promise<any> {
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch {
    // attempt YAML via dynamic import of existing parser logic (parser.ts already handles YAML)
    // lightweight duplication to avoid circular dependency
    const YAML = (await import('yaml')).default;
    obj = YAML.parse(raw);
  }
  try {
    const deref = await SwaggerParser.dereference(obj);
    return deref;
  } catch (e) {
    return obj; // graceful fallback
  }
}
