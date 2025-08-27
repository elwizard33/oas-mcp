import { sanitizeToolName } from '../util/sanitize.js';
import { registerOAuthFlows } from './oauthFlows.js';

// Type-only import to avoid circular runtime dependency
import type { MCPServer } from './mcpServer.js';

// OAuth-specific helpers moved to oauthFlows.ts

/**
 * Register authentication / credential management tools derived from parsed securitySchemes.
 * This is a direct extraction of the original inline block in mcpServer.ts (no behavior changes).
 */
export function registerAuthTools(server: MCPServer, id: string, parsed: any) {
  if (!parsed.securitySchemes) return;
  for (const [schemeName, scheme] of Object.entries(parsed.securitySchemes)) {
    const baseName = `${id}_auth_${sanitizeToolName(schemeName)}`;
    if ((scheme as any).type === 'apiKey') {
      server.addTool({
        name: baseName + '_set',
        description: `Set apiKey credential for scheme ${schemeName} (in ${(scheme as any).in})`,
        input: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] },
        handler: async (call: any) => { const val = call?.arguments?.value; if (!val) return { error: { type: 'input', message: 'value required' } }; await (server as any).setCredential(schemeName, { value: val, in: (scheme as any).in, name: (scheme as any).name }); return { ok: true }; }
      });
    } else if ((scheme as any).type === 'http' && (scheme as any).scheme === 'basic') {
      server.addTool({
        name: baseName + '_set',
        description: `Set basic auth credentials for scheme ${schemeName}`,
        input: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string' } }, required: ['username','password'] },
        handler: async (call: any) => { const { username, password } = call?.arguments || {}; if (!username || !password) return { error: { type: 'input', message: 'username & password required' } }; await (server as any).setCredential(schemeName, { username, password }); return { ok: true }; }
      });
    } else if ((scheme as any).type === 'http' && (scheme as any).scheme === 'bearer') {
      server.addTool({
        name: baseName + '_set',
        description: `Set bearer token for scheme ${schemeName}`,
        input: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] },
        handler: async (call: any) => { const token = call?.arguments?.token; if (!token) return { error: { type: 'input', message: 'token required' } }; await (server as any).setCredential(schemeName, { token }); return { ok: true }; }
      });
    } else if ((scheme as any).type === 'oauth2') {
      registerOAuthFlows(server, schemeName, scheme, baseName);
    } else {
      continue; // unsupported scheme types skipped
    }
    server.addTool({ name: baseName + '_clear', description: `Clear credential for scheme ${schemeName}`, handler: async () => { await (server as any).clearCredential(schemeName); return { ok: true }; } });
  }
  server.addTool({ name: id + '_auth_list_credentials', description: 'List configured credentials (masked)', handler: async () => ({ credentials: (server as any).listCredentialsMasked() }) });
}
