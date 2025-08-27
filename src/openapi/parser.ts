import { APIEndpoint, APIInfo, OpenAPIDoc, Parameter, RequestBody, Schema, SecuritySchemesMap, SecurityRequirement } from './types.js';
import YAML from 'yaml';
import { dereference } from './dereference.js';
import { openapiCache, shouldUseCache } from './cache.js';

export interface ParsedSpec { info: APIInfo; endpoints: APIEndpoint[]; securitySchemes?: SecuritySchemesMap; rootSecurity?: SecurityRequirement[]; }

export async function loadAndParseOpenAPI(raw: string): Promise<ParsedSpec> {
  if (shouldUseCache()) {
    const cached = openapiCache.get(raw);
    if (cached) return cached;
  }
  let doc: OpenAPIDoc;
  try {
    // attempt full dereference (safe fallback inside dereference)
    doc = await dereference(raw);
  } catch {
    // final fallback to simple parse
    try { doc = JSON.parse(raw); }
    catch { try { doc = YAML.parse(raw); } catch { throw new Error('Failed to parse spec as JSON or YAML'); } }
  }
  const endpoints: APIEndpoint[] = [];
  let securitySchemes: SecuritySchemesMap | undefined;
  const paths = doc.paths || {};
  const rootSecurity: SecurityRequirement[] | undefined = Array.isArray((doc as any).security) ? (doc as any).security : undefined;
  for (const [path, value] of Object.entries(paths)) {
    if (typeof value !== 'object' || value == null) continue;
    for (const [method, op] of Object.entries<any>(value as any)) {
      if (!isHttpMethod(method) || typeof op !== 'object') continue;
      // Determine raw security (operation override); undefined means fallback to root
      let opSecurity = op.security;
      const ep: APIEndpoint = {
        path,
        method: method.toUpperCase(),
        summary: op.summary,
        description: op.description,
        operationId: op.operationId,
        parameters: [],
        responses: {},
        security: undefined,
      };
      if (Array.isArray(op.parameters)) {
        for (const p of op.parameters) {
          ep.parameters.push(parseParameter(p));
        }
      }
      if (op.requestBody && typeof op.requestBody === 'object') {
        ep.requestBody = parseRequestBody(op.requestBody);
      }
      if (op.responses && typeof op.responses === 'object') {
        for (const [code, resp] of Object.entries<any>(op.responses)) {
          ep.responses[code] = { description: resp?.description };
        }
      }
      // Resolve effective security:
      // - If op.security is [] (empty array) => no auth required.
      // - If op.security is an array with entries => use it.
      // - If op.security is undefined => inherit rootSecurity.
      if (Array.isArray(opSecurity)) {
        if (opSecurity.length === 0) {
          ep.security = []; // explicit disable
        } else if (opSecurity.every(isSecurityReqObj)) {
          ep.security = opSecurity as SecurityRequirement[];
        }
      } else if (rootSecurity) {
        ep.security = rootSecurity;
      }
      endpoints.push(ep);
    }
  }
  // Extract security schemes
  const comps: any = (doc as any).components;
  if (comps && comps.securitySchemes && typeof comps.securitySchemes === 'object') {
    securitySchemes = {};
    for (const [key, val] of Object.entries<any>(comps.securitySchemes)) {
      if (val && typeof val === 'object') {
        securitySchemes[key] = {
          type: val.type,
            name: val.name,
            in: val.in,
            scheme: val.scheme,
            bearerFormat: val.bearerFormat,
            flows: val.flows,
            description: val.description
        };
      }
    }
  }
  const parsed: ParsedSpec = { info: doc.info || {}, endpoints, securitySchemes, rootSecurity };
  if (shouldUseCache()) {
    openapiCache.set(raw, parsed);
  }
  return parsed;
}

function isHttpMethod(m: string) {
  const set = ['get','post','put','delete','patch','options','head','trace'];
  return set.includes(m.toLowerCase());
}
function isSecurityReqObj(o: any) {
  return o && typeof o === 'object' && Object.keys(o).every(k => Array.isArray(o[k]));
}
function parseParameter(p: any): Parameter { return { name: p?.name, in: p?.in, required: p?.required, description: p?.description, schema: parseSchema(p?.schema), style: p?.style, explode: p?.explode }; }
function parseRequestBody(rb: any): RequestBody {
  const content: Record<string, any> = {};
  if (rb?.content && typeof rb.content === 'object') {
    for (const [ct, mt] of Object.entries<any>(rb.content)) {
      content[ct] = { schema: parseSchema(mt?.schema) };
    }
  }
  return { required: rb?.required, content };
}
function parseSchema(s: any, depth = 0): Schema | undefined {
  if (!s || typeof s !== 'object') return undefined;
  // Prevent pathological recursion
  if (depth > 50) return undefined;
  const schema: Schema = { type: s.type, format: s.format, description: s.description, default: s.default };
  if (Array.isArray(s.enum)) schema.enum = [...s.enum];
  if (s.properties && typeof s.properties === 'object') {
    schema.properties = {};
    for (const [k,v] of Object.entries<any>(s.properties)) {
      const child = parseSchema(v, depth+1); if (child) schema.properties[k] = child;
    }
  }
  if (s.items) schema.items = parseSchema(s.items, depth+1);
  if (Array.isArray(s.required)) schema.required = s.required.filter((x: any) => typeof x === 'string');
  // Capture raw composition arrays
  if (Array.isArray(s.allOf)) schema.allOf = s.allOf.map((c:any) => parseSchema(c, depth+1)!).filter(Boolean);
  if (Array.isArray(s.oneOf)) schema.oneOf = s.oneOf.map((c:any) => parseSchema(c, depth+1)!).filter(Boolean);
  if (Array.isArray(s.anyOf)) schema.anyOf = s.anyOf.map((c:any) => parseSchema(c, depth+1)!).filter(Boolean);
  if (s.discriminator && typeof s.discriminator === 'object' && s.discriminator.propertyName) {
    const mapping = s.discriminator.mapping && typeof s.discriminator.mapping === 'object' ? { ...s.discriminator.mapping } : undefined;
    schema.discriminator = { propertyName: s.discriminator.propertyName, mapping };
  }
  // Attempt simple allOf merge: all subschemas are objects (type object or have properties) and no conflicting property definitions
  if (schema.allOf?.length) {
    const mergables = schema.allOf.every(sub => isSimpleObject(sub));
    if (mergables) {
      const mergedProps: Record<string, Schema> = { ...(schema.properties || {}) };
      let conflict = false;
      for (const sub of schema.allOf) {
        if (sub.properties) {
          for (const [pk,pv] of Object.entries(sub.properties)) {
            if (mergedProps[pk] && JSON.stringify(mergedProps[pk]) !== JSON.stringify(pv)) { conflict = true; break; }
            mergedProps[pk] = pv;
          }
        }
        if (conflict) break;
      }
      if (!conflict) {
        schema.properties = mergedProps;
        const reqSets: string[][] = [];
        if (schema.required) reqSets.push(schema.required);
        for (const sub of schema.allOf) { if (sub.required) reqSets.push(sub.required); }
        if (reqSets.length) schema.required = Array.from(new Set(reqSets.flat()));
        schema._mergedAllOf = true;
      }
    }
  }
  return schema;
}

function isSimpleObject(s: Schema): boolean {
  if (s.type && s.type !== 'object') return false;
  if (s.items) return false; // arrays not merged in this simple pass
  return true; // allow if properties or just type object/undefined
}
