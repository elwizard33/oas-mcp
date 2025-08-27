#!/usr/bin/env node
import { Command } from 'commander';
import { startServer } from './server.js';

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
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
  await startServer({ host: opts.host, port, debug: !!opts.debug, allowFile: !!opts.allowFile, rateLimitStrategy: opts.rateLimitStrategy, streamMode: opts.streamMode, streamThreshold: parseInt(opts.streamThreshold,10), nameCollisionMode: opts.nameCollisionMode, credStore: opts.credStore, verboseNames: !!opts.verboseNames, protectedMode: !!opts.protected, authServer: opts.authServer, authIssuer: opts.authIssuer, tokenAudience: opts.tokenAudience, jwksUri: opts.jwksUri, insecureUnsignedTokens: !!opts.insecureUnsignedTokens, proxyRegister: !!opts.proxyRegister });
  });

program.parseAsync(process.argv);
