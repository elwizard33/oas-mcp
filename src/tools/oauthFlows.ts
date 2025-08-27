import crypto from 'node:crypto';
// Type-only import to avoid circular runtime dependency
import type { MCPServer } from './mcpServer.js';

// Small local helper (duplicated earlier) retained here; consider centralizing later
function base64UrlEncode(bytes: Uint8Array) {
  return Buffer.from(bytes).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
}

/**
 * Register OAuth2 flow specific tools for a given security scheme.
 * Extracted from the original authTools file (no behavior changes intended).
 */
export function registerOAuthFlows(server: MCPServer, schemeName: string, scheme: any, baseName: string) {
  if (scheme.type !== 'oauth2') return;
  const flows = scheme.flows || {};

  // Generic set token tool (manual insertion of access token)
  server.addTool({
    name: baseName + '_set_token',
    description: `Set OAuth2 access token for scheme ${schemeName}`,
    input: { type: 'object', properties: { accessToken: { type: 'string' } }, required: ['accessToken'] },
    handler: async (call: any) => { const at = call?.arguments?.accessToken; if (!at) return { error: { type: 'input', message: 'accessToken required' } }; await (server as any).setCredential(schemeName, { accessToken: at }); return { ok: true }; }
  });

  // Client Credentials Flow
  if (flows.clientCredentials && flows.clientCredentials.tokenUrl) {
    server.addTool({
      name: baseName + '_configure_client_credentials',
      description: `Configure client credentials (client_id, client_secret, optional scope) for scheme ${schemeName}`,
      input: { type: 'object', properties: { clientId: { type: 'string' }, clientSecret: { type: 'string' }, scope: { type: 'string' } }, required: ['clientId','clientSecret'] },
      handler: async (call: any) => { const { clientId, clientSecret, scope } = call?.arguments || {}; if (!clientId || !clientSecret) return { error: { type: 'input', message: 'clientId & clientSecret required' } }; await (server as any).setCredential(schemeName, { ...(server as any).getCredentialRaw(schemeName), clientId, clientSecret, scope, tokenUrl: flows.clientCredentials.tokenUrl }); return { ok: true }; }
    });
    server.addTool({
      name: baseName + '_fetch_client_token',
      description: `Fetch (or refresh) client credentials token for scheme ${schemeName}`,
      handler: async () => { await (server as any).ensureOAuthClientCredentialsToken(schemeName, scheme, fetch); const cred = (server as any).getCredentialRaw(schemeName); return cred?.accessToken ? { ok: true, expiresAt: cred.expiresAt } : { error: { type: 'auth', message: 'Failed to obtain token' } }; }
    });
  }

  // Authorization Code Flow (PKCE)
  if (flows.authorizationCode && flows.authorizationCode.authorizationUrl && flows.authorizationCode.tokenUrl) {
    server.addTool({
      name: baseName + '_configure_auth_code',
      description: `Configure auth code client (client_id, redirect_uri, optional scope, optional client_secret for confidential) for scheme ${schemeName}`,
      input: { type: 'object', properties: { clientId: { type: 'string' }, redirectUri: { type: 'string' }, scope: { type: 'string' }, clientSecret: { type: 'string' } }, required: ['clientId','redirectUri'] },
      handler: async (call: any) => { const { clientId, redirectUri, scope, clientSecret } = call?.arguments || {}; if (!clientId || !redirectUri) return { error: { type: 'input', message: 'clientId & redirectUri required' } }; const existing = (server as any).getCredentialRaw(schemeName) || {}; await (server as any).setCredential(schemeName, { ...existing, clientId, redirectUri, scope, clientSecret, authUrl: flows.authorizationCode.authorizationUrl, tokenUrl: flows.authorizationCode.tokenUrl }); return { ok: true }; }
    });
    server.addTool({
      name: baseName + '_auth_code_generate_url',
      description: `Generate authorization URL (with PKCE code challenge + state) for scheme ${schemeName}`,
      handler: async () => { const cred = (server as any).getCredentialRaw(schemeName); if (!cred?.clientId || !cred?.redirectUri || !cred?.authUrl) return { error: { type: 'input', message: 'Client not configured (configure_auth_code first)' } }; const codeVerifier = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32))); const encoder = new TextEncoder(); const data = encoder.encode(codeVerifier); const hashBuf = await crypto.subtle.digest('SHA-256', data); const challenge = base64UrlEncode(new Uint8Array(hashBuf)); const state = base64UrlEncode(crypto.getRandomValues(new Uint8Array(12))); const sp = new URLSearchParams(); sp.set('response_type', 'code'); sp.set('client_id', cred.clientId); sp.set('redirect_uri', cred.redirectUri); if (cred.scope) sp.set('scope', cred.scope); sp.set('code_challenge', challenge); sp.set('code_challenge_method', 'S256'); sp.set('state', state); const url = cred.authUrl + (cred.authUrl.includes('?') ? '&' : '?') + sp.toString(); await (server as any).setCredential(schemeName, { ...cred, pendingAuth: { codeVerifier, state } }); return { ok: true, authorization_url: url, state }; }
    });
    server.addTool({
      name: baseName + '_auth_code_exchange_code',
      description: `Exchange authorization code for tokens for scheme ${schemeName}`,
      input: { type: 'object', properties: { code: { type: 'string' }, state: { type: 'string' } }, required: ['code'] },
      handler: async (call: any) => { const { code, state } = call?.arguments || {}; const cred = (server as any).getCredentialRaw(schemeName); if (!cred?.pendingAuth?.codeVerifier || !cred?.tokenUrl || !cred?.clientId || !cred?.redirectUri) return { error: { type: 'input', message: 'No pending authorization (generate_url first)' } }; if (state && state !== cred.pendingAuth.state) return { error: { type: 'auth', message: 'State mismatch' } }; const body = new URLSearchParams(); body.set('grant_type', 'authorization_code'); body.set('code', code); body.set('redirect_uri', cred.redirectUri); body.set('client_id', cred.clientId); body.set('code_verifier', cred.pendingAuth.codeVerifier); if (cred.clientSecret) body.set('client_secret', cred.clientSecret); const resp = await fetch(cred.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }); let json: any; try { json = await resp.json(); } catch { return { error: { type: 'auth', message: 'Invalid token response' } } }; if (!resp.ok || !json.access_token) return { error: { type: 'auth', message: 'Token exchange failed' } }; const expiresIn = Number(json.expires_in) || 3600; const updated = { ...cred, accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt: Date.now() + expiresIn*1000 }; delete updated.pendingAuth; await (server as any).setCredential(schemeName, updated); return { ok: true, access_token: json.access_token, refresh_token: json.refresh_token, expires_at: updated.expiresAt }; }
    });
  }

  // Device Code Flow
  if (flows.deviceCode && flows.deviceCode.tokenUrl && flows.deviceCode.deviceCodeUrl) {
    server.addTool({
      name: baseName + '_configure_device_code',
      description: `Configure device code client (client_id, optional scope) for scheme ${schemeName}`,
      input: { type: 'object', properties: { clientId: { type: 'string' }, scope: { type: 'string' } }, required: ['clientId'] },
      handler: async (call: any) => { const { clientId, scope } = call?.arguments || {}; if (!clientId) return { error: { type: 'input', message: 'clientId required' } }; const existing = (server as any).getCredentialRaw(schemeName) || {}; await (server as any).setCredential(schemeName, { ...existing, clientId, scope, deviceCodeUrl: flows.deviceCode.deviceCodeUrl, tokenUrl: flows.deviceCode.tokenUrl }); return { ok: true }; }
    });
    server.addTool({
      name: baseName + '_start_device_code',
      description: `Start OAuth2 device code flow for scheme ${schemeName}`,
      handler: async () => { const cred = (server as any).getCredentialRaw(schemeName); if (!cred?.clientId || !cred?.deviceCodeUrl) return { error: { type: 'input', message: 'client not configured (configure_device_code first)' } }; const body = new URLSearchParams(); body.set('client_id', cred.clientId); if (cred.scope) body.set('scope', cred.scope); const resp = await fetch(cred.deviceCodeUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() }); if (!resp.ok) return { error: { type: 'auth', message: `Device code start failed ${resp.status}` } }; let json: any; try { json = await resp.json(); } catch { return { error: { type: 'auth', message: 'Invalid JSON from device code endpoint' } }; } const { device_code, user_code, verification_uri, verification_uri_complete, expires_in, interval } = json; if (!device_code || !user_code) return { error: { type: 'auth', message: 'Missing device_code/user_code in response' } }; const updated = { ...cred, pendingDevice: { device_code, user_code, verification_uri, verification_uri_complete, expiresAt: Date.now() + (expires_in||900)*1000, interval: (interval||5)*1000 } }; await (server as any).setCredential(schemeName, updated); return { ok: true, user_code, verification_uri, verification_uri_complete, interval: updated.pendingDevice.interval/1000, expires_at: updated.pendingDevice.expiresAt }; }
    });
    server.addTool({
      name: baseName + '_poll_device_code',
      description: `Poll device code to obtain token for scheme ${schemeName}`,
      input: { type: 'object', properties: { maxWaitSeconds: { type: 'number', description: 'Max time to poll before giving up' } } },
      handler: async (call: any) => { const cred = (server as any).getCredentialRaw(schemeName); if (!cred?.pendingDevice?.device_code) return { error: { type: 'input', message: 'No pending device code (start_device_code first)' } }; const maxWaitMs = (call?.arguments?.maxWaitSeconds ? Number(call.arguments.maxWaitSeconds) : 180) * 1000; const start = Date.now(); const intervalMsOrig = cred.pendingDevice.interval || 5000; let intervalMs = intervalMsOrig; while (Date.now() - start < maxWaitMs) { if (Date.now() > cred.pendingDevice.expiresAt) return { error: { type: 'auth', message: 'Device code expired' } }; const pollBody = new URLSearchParams(); pollBody.set('grant_type', 'urn:ietf:params:oauth:grant-type:device_code'); pollBody.set('device_code', cred.pendingDevice.device_code); pollBody.set('client_id', cred.clientId); const tokenResp = await fetch(cred.tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: pollBody.toString() }); let json: any = undefined; try { json = await tokenResp.json(); } catch { /* ignore */ } if (tokenResp.ok && json?.access_token) { const expiresIn = Number(json.expires_in) || 3600; const updated = { ...cred, accessToken: json.access_token, expiresAt: Date.now() + expiresIn*1000 }; delete updated.pendingDevice; await (server as any).setCredential(schemeName, updated); return { ok: true, access_token: json.access_token, expires_at: updated.expiresAt }; } const err = json?.error; if (err === 'authorization_pending') { await new Promise(r => setTimeout(r, intervalMs)); continue; } else if (err === 'slow_down') { intervalMs += 5000; await new Promise(r => setTimeout(r, intervalMs)); continue; } else if (err === 'expired_token' || err === 'access_denied') { return { error: { type: 'auth', message: err } }; } else { return { error: { type: 'auth', message: err || 'Unknown polling error' } }; } } return { error: { type: 'timeout', message: 'Polling timeout exceeded' } }; }
    });
  }

  // Refresh helper (explicit trigger)
  server.addTool({
    name: baseName + '_refresh_token',
    description: `Refresh OAuth token for scheme ${schemeName} if refresh_token available` ,
    handler: async () => { await (server as any).refreshOAuthTokenIfNeeded(schemeName, fetch); const cred = (server as any).getCredentialRaw(schemeName); return cred?.accessToken ? { ok: true, expiresAt: cred.expiresAt } : { error: { type: 'auth', message: 'No access token present' } }; }
  });
}
