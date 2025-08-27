import SwaggerParser from '@apidevtools/swagger-parser';
import YAML from 'yaml';
import type { ParsedSpec } from '../types';

export async function parseSpec(raw: string): Promise<ParsedSpec> {
  let obj: any;
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Empty spec');
  try {
    if (trimmed.startsWith('{')) obj = JSON.parse(trimmed);
    else obj = YAML.parse(trimmed);
  } catch (e:any) {
    throw new Error('Failed to parse JSON/YAML: ' + e.message);
  }
  // Dereference with swagger-parser for validation
  try {
    const deref: any = await SwaggerParser.dereference(obj);
    return { raw: obj, deref };
  } catch (e:any) {
    throw new Error('Spec validation/dereference failed: ' + e.message);
  }
}
