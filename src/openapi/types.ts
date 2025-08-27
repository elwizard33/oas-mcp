export interface APIInfo { title?: string; version?: string; description?: string; }
export interface Server { url?: string; description?: string; }
export interface Schema {
  type?: string; format?: string; description?: string; default?: any;
  enum?: any[]; properties?: Record<string, Schema>; items?: Schema; required?: string[];
  // Composition (captured from source spec)
  allOf?: Schema[]; // retained prior to merge for debugging/reference
  oneOf?: Schema[];
  anyOf?: Schema[];
  discriminator?: { propertyName: string; mapping?: Record<string,string> };
  // Internal flags
  _mergedAllOf?: boolean; // indicates properties/required represent merged allOf simple objects
}
export interface Parameter { name?: string; in?: string; required?: boolean; description?: string; schema?: Schema; style?: string; explode?: boolean; }
export interface MediaType { schema?: Schema; }
export interface RequestBody { required?: boolean; content: Record<string, MediaType>; }
export interface Response { description?: string; content?: Record<string, MediaType>; }
export interface APIEndpoint {
  path: string; method: string; summary?: string; description?: string; operationId?: string;
  parameters: Parameter[]; requestBody?: RequestBody; responses: Record<string, Response>;
  security?: SecurityRequirement[]; // resolved effective security (OR list of requirement objects)
}
export interface OpenAPIDoc { info?: APIInfo; servers?: Server[]; paths?: Record<string, any>; }
// Security schemes (simplified)
export interface SecurityScheme {
  type?: string; // apiKey, http, oauth2, openIdConnect
  name?: string; // for apiKey
  in?: string;   // header/query/cookie
  scheme?: string; // for http (basic, bearer)
  bearerFormat?: string;
  flows?: any; // retain raw for oauth2 (authorizationCode, clientCredentials, deviceCode, etc.)
  description?: string;
}

export interface SecuritySchemesMap { [key: string]: SecurityScheme; }
// A requirement object: key = scheme name, value = array of scopes (oauth2) or empty array
export interface SecurityRequirement { [schemeName: string]: string[]; }
