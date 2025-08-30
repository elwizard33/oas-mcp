#!/usr/bin/env node
import { Command } from 'commander';
import { startServer } from './server.js';
import { parseRequestParams } from './util/params.js';
import { buildMcpSdkServer } from './mcp/sdkFactory.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createStreamableHttpApp } from './mcp/httpServer.js';

const program = new Command();
program
  .name('oas-mcp')
  .description('Convert OpenAPI to MCP compatible endpoints (TypeScript)')
  .version('0.1.0');

program.command('serve')
  .description('Start the OAS-MCP server')
  .option('-p, --port <number>', 'Port to listen on', '8080')
  .option('-H, --host <host>', 'Host to listen on', '127.0.0.1')
  .option('--debug', 'Enable debug logging', false)
  .option('--rate-limit-strategy <strategy>', 'Rate limiting strategy: fixed | token-bucket', 'fixed')
  .option('--stream-mode <mode>', 'Streaming mode: off | chunk', 'off')
  .option('--stream-threshold <bytes>', 'Threshold (bytes) above which responses stream in chunk mode', '65536')
  .option('--name-collision-mode <mode>', 'Tool name collision mode: suffix | hash', 'suffix')
  .option('--cred-store <mode>', 'Credential store: memory | file', 'memory')
  .option('--allow-file', 'Allow loading local file OpenAPI schemas (disabled by default for security)', false)
  .option('--verbose-names', 'Use verbose tool names derived from host + path (legacy style)', false)
  .option('--protected', 'Enable protected mode (require bearer token + expose OAuth metadata)', false)
  .option('--auth-server <url>', 'Authorization server base URL (for metadata advertisement)')
  .option('--auth-issuer <issuer>', 'Override issuer value in AS metadata')
  .option('--token-audience <aud>', 'Expected audience/resource indicator substring check')
  .option('--jwks-uri <url>', 'JWKS URI for JWT signature verification (RS256/ES256)')
  .option('--insecure-unsigned-tokens', 'Allow unsigned / unverifiable tokens (testing only)', false)
  .option('--proxy-register', 'Proxy dynamic client registration to auth server /register endpoint', false)
  .option('--proxy-oauth', 'Proxy OAuth token exchange (/oauth/token) to auth server token endpoint', false)
  .option('--dns-rebind-protect', 'Enable DNS rebinding protection (restrict Host + remote address)', false)
  .option('--allow-host <host...>', 'Additional allowed hostnames for DNS rebinding protection')
  .option('--sdk', 'Use official MCP SDK HTTP+SSE replacement (experimental full migration)', false)
  .action(async (opts) => {
    if (opts.sdk) {
      console.log('[sdk] Starting SDK stdio server (use with a client that spawns this process).');
      const rawParams: any = { s: opts.schema, u: opts.base, n: opts.serverName };
      try {
        const parsed = await parseRequestParams(rawParams);
        const { server } = await buildMcpSdkServer(parsed as any, { debug: !!opts.debug, allowFile: !!opts.allowFile });
        const transport = new StdioServerTransport();
        await server.connect(transport);
      } catch (e:any) {
        console.error('[sdk] failed to start:', e.message);
        process.exit(1);
      }
      return;
    }
    const port = parseInt(opts.port, 10);
  await startServer({ host: opts.host, port, debug: !!opts.debug, allowFile: !!opts.allowFile, rateLimitStrategy: opts.rateLimitStrategy, streamMode: opts.streamMode, streamThreshold: parseInt(opts.streamThreshold,10), nameCollisionMode: opts.nameCollisionMode, credStore: opts.credStore, verboseNames: !!opts.verboseNames, protectedMode: !!opts.protected, authServer: opts.authServer, authIssuer: opts.authIssuer, tokenAudience: opts.tokenAudience, jwksUri: opts.jwksUri, insecureUnsignedTokens: !!opts.insecureUnsignedTokens, proxyRegister: !!opts.proxyRegister, proxyOAuth: !!opts.proxyOauth || !!opts.proxyOAuth, dnsRebindProtect: !!opts.dnsRebindProtect, allowedHosts: opts.allowHost });
  });

program.command('serve-sdk')
  .description('Start an SDK stdio MCP server for a single OpenAPI spec')
  .requiredOption('-s, --schema <url>', 'OpenAPI schema URL or file path')
  .requiredOption('-u, --base <url>', 'API base URL for calling endpoints')
  .option('-n, --server-name <name>', 'Custom server name id prefix')
  .option('--allow-file', 'Allow local file schema', false)
  .option('--debug', 'Debug logging', false)
  .action(async (opts) => {
    const rawParams: any = { s: opts.schema, u: opts.base, n: opts.serverName };
    try {
      const parsed = await parseRequestParams(rawParams);
      const { server } = await buildMcpSdkServer(parsed as any, { debug: !!opts.debug, allowFile: !!opts.allowFile });
      const transport = new StdioServerTransport();
      await server.connect(transport);
      if (opts.debug) console.error('[sdk] server running on stdio');
    } catch (e:any) {
      console.error('[sdk] failed to start:', e.message);
      process.exit(1);
    }
  });

program.command('serve-http-sdk')
  .description('Start Streamable HTTP MCP server (multi-session)')
  .option('-p, --port <number>', 'Port', '3000')
  .option('-H, --host <host>', 'Host', '127.0.0.1')
  .option('--debug', 'Debug logging', false)
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const app = createStreamableHttpApp({ debug: !!opts.debug });
    app.listen(port, opts.host, () => {
      console.log(`[sdk-http] listening on http://${opts.host}:${port}`);
    });
  });

program.parseAsync(process.argv);
