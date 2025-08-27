import { describe, it, expect, vi } from 'vitest';
import { createMcpServer } from '../src/tools/mcpServer.js';

const spec = {
  openapi: '3.0.0',
  info: { title: 'OAuth Device', version: '1.0.0' },
  components: { securitySchemes: {
    DevOAuth: { type: 'oauth2', flows: { deviceCode: { deviceCodeUrl: 'https://auth.example.com/device', tokenUrl: 'https://auth.example.com/token' } } }
  }},
  paths: { '/protected': { get: { security: [ { DevOAuth: [] } ] } } }
};

const params: any = { baseURL: 'https://api.example.com', schemaURL: 'data:application/json,' + encodeURIComponent(JSON.stringify(spec)), filters: [] };

describe('OAuth2 device code flow tools', () => {
  it('runs full device flow: configure -> start -> poll (pending -> success) and injects token', async () => {
    let pollAttempts = 0;
    const fetchSpy = vi.fn(async (url: string, init?: any) => {
      if (url === 'https://auth.example.com/device') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ device_code: 'devcode123', user_code: 'USER-CODE', verification_uri: 'https://verify.example.com', verification_uri_complete: 'https://verify.example.com/complete', expires_in: 600, interval: 1 }),
          text: async () => '{}',
          arrayBuffer: async () => new ArrayBuffer(0)
        } as any;
      }
      if (url === 'https://auth.example.com/token') {
        pollAttempts++;
        if (pollAttempts < 2) {
          return {
            ok: 400,
            status: 400,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ error: 'authorization_pending' }),
            text: async () => JSON.stringify({ error: 'authorization_pending' }),
            arrayBuffer: async () => new ArrayBuffer(0)
          } as any;
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ access_token: 'DEVICE_TOKEN', expires_in: 3600 }),
          text: async () => '{}',
          arrayBuffer: async () => new ArrayBuffer(0)
        } as any;
      }
      // protected resource
      if (url.startsWith('https://api.example.com')) {
        const auth = (init?.headers || {})['Authorization'] || (init?.headers instanceof Headers ? init.headers.get('Authorization') : undefined);
        return {
          ok: !!auth,
          status: !!auth ? 200 : 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          text: async () => JSON.stringify({ auth }),
          arrayBuffer: async () => new ArrayBuffer(0)
        } as any;
      }
      throw new Error('Unexpected URL ' + url);
    });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tools = server.listTools();
    const configure = tools.find(t => t.name.includes('devoauth_configure_device_code'))!.name;
    const start = tools.find(t => t.name.includes('devoauth_start_device_code'))!.name;
    const poll = tools.find(t => t.name.includes('devoauth_poll_device_code'))!.name;
    const protectedTool = tools.find(t => t.name.includes('get_protected'))!.name;

    await server.callTool(configure, { arguments: { clientId: 'myClient', scope: 'offline openid' } });
    const startResp: any = await server.callTool(start, { arguments: {} });
    expect(startResp.user_code).toBe('USER-CODE');
    const pollResp: any = await server.callTool(poll, { arguments: { maxWaitSeconds: 5 } });
    expect(pollResp.access_token).toBe('DEVICE_TOKEN');
    const apiResp: any = await server.callTool(protectedTool, { arguments: {} });
    expect(apiResp.status).toBe(200);
    expect(fetchSpy.mock.calls.some(c => c[0] === 'https://auth.example.com/device')).toBe(true);
    expect(fetchSpy.mock.calls.some(c => c[0] === 'https://auth.example.com/token')).toBe(true);
  });

  it('handles expired device code during polling', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (url === 'https://auth.example.com/device') {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ device_code: 'devcodeX', user_code: 'USER', verification_uri: 'https://verify.example.com', expires_in: 1, interval: 1 }),
          text: async () => '{}',
          arrayBuffer: async () => new ArrayBuffer(0)
        } as any;
      }
      if (url === 'https://auth.example.com/token') {
        return {
          ok: 400,
          status: 400,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ error: 'authorization_pending' }),
          text: async () => JSON.stringify({ error: 'authorization_pending' }),
          arrayBuffer: async () => new ArrayBuffer(0)
        } as any;
      }
      return { ok: true, status: 200, headers: new Headers(), text: async () => '{}', arrayBuffer: async () => new ArrayBuffer(0) } as any;
    });
    // @ts-ignore
    global.fetch = fetchSpy;
    const server = await createMcpServer(params, { debug: false, allowFile: false });
    const tools = server.listTools();
    const configure = tools.find(t => t.name.includes('devoauth_configure_device_code'))!.name;
    const start = tools.find(t => t.name.includes('devoauth_start_device_code'))!.name;
    const poll = tools.find(t => t.name.includes('devoauth_poll_device_code'))!.name;
    await server.callTool(configure, { arguments: { clientId: 'client' } });
    await server.callTool(start, { arguments: {} });
    // wait for expiration
    await new Promise(r => setTimeout(r, 1200));
    const resp: any = await server.callTool(poll, { arguments: { maxWaitSeconds: 2 } });
    expect(resp.error?.message).toBe('Device code expired');
  });
});
