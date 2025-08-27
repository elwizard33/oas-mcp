import { describe, it, expect } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'Cred', version: '1.0.0' },
  components: {
    securitySchemes: {
      ApiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      BasicAuth: { type: 'http', scheme: 'basic' },
      BearerAuth: { type: 'http', scheme: 'bearer' },
      OAuth2CC: { type: 'oauth2', flows: { clientCredentials: { tokenUrl: 'https://auth/token', scopes: { read: 'Read' } } } }
    }
  },
  paths: { '/ping': { get: { summary: 'Ping' } } }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('Credential configuration tools', () => {
  it('creates set/clear tools and masks listed credentials', async () => {
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const toolNames = server.listTools().map(t => t.name);
    const setApiKey = toolNames.find(n => n.includes('auth_apikeyheader_set'))!;
    const setBasic = toolNames.find(n => n.includes('auth_basicauth_set'))!;
    const setBearer = toolNames.find(n => n.includes('auth_bearerauth_set'))!;
    const setOAuth = toolNames.find(n => n.includes('auth_oauth2cc_set_token'))!;
    expect(setApiKey && setBasic && setBearer && setOAuth).toBeTruthy();
    await server.callTool(setApiKey, { arguments: { value: 'SECRETAPIKEY' } });
    await server.callTool(setBasic, { arguments: { username: 'user', password: 'pass1234' } });
    await server.callTool(setBearer, { arguments: { token: 'TOKENVALUE' } });
    await server.callTool(setOAuth, { arguments: { accessToken: 'OATOKEN' } });
    const listTool = toolNames.find(n => n.endsWith('_auth_list_credentials'))!;
    const listed: any = await server.callTool(listTool, {});
    expect(listed.credentials.ApiKeyHeader.value).not.toContain('SECRETAPIKEY');
    expect(listed.credentials.BasicAuth.password).not.toContain('pass1234');
    expect(listed.credentials.BearerAuth.token).not.toContain('TOKENVALUE');
    expect(listed.credentials.OAuth2CC.accessToken).not.toContain('OATOKEN');
  });
});
