// Temporary shim for '@apidevtools/swagger-parser' to satisfy TS if types not resolved.
// Remove once node_modules installed (run `npm install`).
declare module '@apidevtools/swagger-parser' {
  interface SwaggerParserAPI {
    dereference(api: any): Promise<any>;
    // other methods can be added here if needed in future
  }
  const SwaggerParser: SwaggerParserAPI;
  export default SwaggerParser;
}
