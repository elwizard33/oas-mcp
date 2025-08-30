import express, { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { parseRequestParams } from '../util/params.js';
import { buildMcpSdkServer } from './sdkFactory.js';
import { MultiServerManager, registerManagementTools } from './multiManager.js';

interface SessionTransport { transport: StreamableHTTPServerTransport; server: McpServer; }

export function createStreamableHttpApp(opts: { debug?: boolean, stateless?: boolean } ) {
  const app = express();
  app.use(express.json());
  const sessions: Record<string, SessionTransport> = {};
  const manager = new MultiServerManager(!!opts.debug);
  // Management root server (shared) created lazily per session if no openapi params provided

  app.post('/mcp', async (req: Request, res: Response) => {
    try {
      const sessionIdHeader = req.headers['mcp-session-id'] as string | undefined;
      if (opts.stateless) {
        // In stateless mode each request initializes a transient server (no persistence)
        if (!isInitializeRequest(req.body)) { return res.status(400).json({ jsonrpc:'2.0', error:{ code:-32000, message:'Stateless mode requires initialize each request'}, id:req.body?.id||null }); }
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
        const rawParams: any = req.body?.params?.capabilities?.experimental?.openapiParams || null;
        let server: McpServer;
        if (rawParams && rawParams.schemaURL && rawParams.baseURL) {
          let parsed; try { parsed = await parseRequestParams(rawParams); } catch { parsed = { filters: [] }; }
          ({ server } = await buildMcpSdkServer(parsed as any, { debug: !!opts.debug, allowFile: true }));
        } else {
          server = new McpServer({ name: 'oas_manager', version: '0.1.0' });
          registerManagementTools(server, manager);
        }
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        setImmediate(()=> transport.close());
        return;
      }
      if (sessionIdHeader && sessions[sessionIdHeader]) {
        await sessions[sessionIdHeader].transport.handleRequest(req, res, req.body);
        return;
      }
      if (!sessionIdHeader && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => { if (opts.debug) console.log('[http] session initialized', sid); }
        });
        const rawParams: any = req.body?.params?.capabilities?.experimental?.openapiParams || null;
        let server: McpServer;
        if (rawParams && rawParams.schemaURL && rawParams.baseURL) {
          let parsed;
          try { parsed = await parseRequestParams(rawParams); } catch { parsed = { filters: [] }; }
          ({ server } = await buildMcpSdkServer(parsed as any, { debug: !!opts.debug, allowFile: true }));
        } else {
          server = new McpServer({ name: 'oas_manager', version: '0.1.0' });
          registerManagementTools(server, manager);
        }
        await server.connect(transport);
        transport.onclose = () => { if (transport.sessionId) delete sessions[transport.sessionId]; };
        sessions[transport.sessionId!] = { transport, server };
        await transport.handleRequest(req, res, req.body);
        return;
      }
      res.status(400).json({ jsonrpc:'2.0', error:{ code:-32000, message:'Bad Request: No valid session' }, id:null });
    } catch (e:any) {
      res.status(500).json({ jsonrpc:'2.0', error:{ code:-32603, message:e.message }, id:null });
    }
  });

  app.get('/mcp', async (req: Request, res: Response) => {
    const sid = req.headers['mcp-session-id'] as string | undefined;
    if (!sid || !sessions[sid]) { res.status(400).send('Invalid or missing session ID'); return; }
    await sessions[sid].transport.handleRequest(req, res);
  });

  // SSE fallback for notifications: /mcp/events?session=<id>
  app.get('/mcp/events', async (req: Request, res: Response) => {
    const sid = (req.query.session as string) || (req.headers['mcp-session-id'] as string);
    if (!sid || !sessions[sid]) { res.status(400).send('Invalid or missing session ID'); return; }
    // Reuse transport's SSE handler
    await sessions[sid].transport.handleRequest(Object.assign(req, { method:'GET', headers: { ...req.headers, 'accept': 'text/event-stream' } }), res);
  });

  app.delete('/mcp', async (req: Request, res: Response) => {
    const sid = req.headers['mcp-session-id'] as string | undefined;
    if (!sid || !sessions[sid]) { res.status(400).send('Invalid or missing session ID'); return; }
    sessions[sid].transport.close();
    delete sessions[sid];
    res.status(204).end();
  });

  return app;
}
