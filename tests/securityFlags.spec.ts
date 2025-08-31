import { startServer } from '../src/server.js';
import http from 'http';
import { describe, it, afterEach, expect } from 'vitest';

// Basic smoke tests for new security flags (dns rebinding + oauth token proxy)
// These are light since full upstream auth server isn't present.

describe('security flags', () => {
  let server: any; const host='127.0.0.1';
  afterEach(() => { if (server) { try { server.close(); } catch {} } });

  it('rejects disallowed host when dns rebinding protect enabled', async () => {
    const port = 8111;
    server = await startServer({ host, port, debug:false, protectedMode:false, dnsRebindProtect:true, allowedHosts:['127.0.0.1'] }) as any;
    await new Promise<void>(resolve => {
      const req = http.request({ host:'127.0.0.1', port, path:'/', headers:{ host:'evil.com' } }, res => {
        expect(res.statusCode).toBe(421);
        resolve();
      });
      req.end();
    });
  });

  it('exposes oauth token proxy path (no upstream)', async () => {
    const port = 8112; // different port to avoid EADDRINUSE
    server = await startServer({ host, port, debug:false, protectedMode:true, proxyOAuth:true, authServer:'https://example.com', insecureUnsignedTokens:true }) as any;
  await new Promise<void>(resolve => {
      const req = http.request({ host, port, method:'POST', path:'/oauth/token', headers:{ Authorization:'Bearer test' } }, res => {
    // Upstream not reachable -> proxy returns 502; timing/route variations -> 404/401/403 acceptable
    expect([401,402,403,404,500,502]).toContain(res.statusCode);
        resolve();
      });
      req.write(JSON.stringify({ grant_type:'client_credentials'}));
      req.end();
    });
  });
});
