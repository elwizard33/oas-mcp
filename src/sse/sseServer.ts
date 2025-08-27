import { randomUUID } from 'crypto';
import { MCPServer } from '../tools/mcpServer.js';
import fs from 'fs/promises';
import path from 'path';

interface Session {
  id: string;
  server: MCPServer;
  res?: any; // active SSE response
  heartbeat?: NodeJS.Timeout;
}

interface BuildServerParams {
  s?: string; u?: string; h?: string; f?: string | string[]; code?: string; n?: string;
}

async function readVersion(): Promise<string> {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const txt = await fs.readFile(pkgPath, 'utf8');
    const json = JSON.parse(txt);
    return json.version || '0.0.0-dev';
  } catch { return '0.0.0-dev'; }
}

export function buildSseServer({ debug }: { debug: boolean }) {
  const sessions = new Map<string, Session>();

  async function handleSse(req: any, res: any, builder: (params: BuildServerParams) => Promise<MCPServer>) {
    // Some clients (or misconfigurations) might POST to /sse; accept and treat as GET for compatibility.
    if (req.method && req.method !== 'GET') {
      // Drain body if any, then continue.
      req.on('data', () => {});
    }
    const url = new URL(req.url!, `http://${req.headers.host}`);
    let params: BuildServerParams = Object.fromEntries(url.searchParams.entries());
    // Fallback: some clients double-encode '=' and '&' so the whole query becomes one key like
    //   /sse?s%3Dhttps%3A%2F%2Fraw...%26u%3Dhttps%3A%2F%2Fapi.example.com
    // After URL parsing above, searchParams has a single entry with key 's=https://raw...&u=https://api.example.com'
    // Detect this and re-parse.
    if (!params.s && !params.u && url.searchParams.size === 1) {
      const onlyKey = [...url.searchParams.keys()][0];
      if (/s=https?:/i.test(onlyKey)) {
        // Attempt to rehydrate a proper query string
        try {
          // The key already has decoded '&' separators if %26 was present.
          const faux = new URLSearchParams(onlyKey);
          const maybeS = faux.get('s');
          const maybeU = faux.get('u');
          if (maybeS || maybeU) {
            params = { ...params };
            if (maybeS) (params as any).s = maybeS;
            if (maybeU) (params as any).u = maybeU;
          }
        } catch {/* ignore */}
      } else if (/%3D/.test([...url.searchParams.keys()][0])) {
        // Raw still percent-encoded; decode entire raw query and retry
        try {
          const rawQuery = req.url!.split('?')[1] || '';
            const decoded = decodeURIComponent(rawQuery);
            const reparsed = new URLSearchParams(decoded);
            if (reparsed.get('s') || reparsed.get('u')) {
              params = Object.fromEntries(reparsed.entries());
            }
        } catch {/* ignore */}
      }
    }

    let server: MCPServer;
    try {
      server = await builder(params);
    } catch (e: any) {
      // Build a minimal server with a single error tool so client can surface problem gracefully
      const fallbackId = 'error_' + Math.random().toString(36).slice(2,8);
      server = new MCPServer(fallbackId, !!debug, undefined as any);
      server.addTool({ name: fallbackId + '_error', description: 'Server build error', handler: async () => ({ error: e?.message || 'Unknown server build error' }) });
    }
    const id = randomUUID();
  const session: Session = { id, server, res };
  sessions.set(id, session);

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    res.write(`event: endpoint\ndata: /message?sessionId=${id}\n\n`);

    // Heartbeat every 25s to keep intermediaries from closing idle connection
    session.heartbeat = setInterval(() => {
      try { res.write(`event: ping\ndata: ${Date.now()}\n\n`); } catch {/* ignore */}
    }, 25_000);

    req.on('close', () => {
      if (session.heartbeat) clearInterval(session.heartbeat);
      sessions.delete(id);
    });
  }

  async function handleMessage(req: any, res: any) {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId || !sessions.has(sessionId)) { res.statusCode = 400; res.end('Invalid sessionId'); return; }
    const session = sessions.get(sessionId)!;

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString('utf8');
    let msg: any; try { msg = JSON.parse(raw); } catch { res.statusCode = 400; res.end('Bad JSON'); return; }

  if (msg.method === 'initialize') {
      const version = await readVersion();
      const result = {
        protocolVersion: '2024-06-24',
        serverInfo: { name: 'oas-mcp', version },
        capabilities: {
          tools: { listChanged: true }
        }
      };
      enqueue(session, { id: msg.id, result });
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: msg.id, result }));
      return;
    }
    if (msg.method === 'ping') {
      const result = { ok: true, ts: Date.now() };
      enqueue(session, { id: msg.id, result });
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: msg.id, result }));
      return;
    }
    if (msg.method === 'tools/list') {
      const list = session.server.listTools();
      enqueue(session, { id: msg.id, result: { tools: list } });
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: msg.id, result: { tools: list } }));
      return;
    }
    if (msg.method === 'tools/call') {
      try {
        const { name, arguments: args } = msg.params || {};
        const result = await session.server.callTool(name, { arguments: args });
        enqueue(session, { id: msg.id, result });
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: msg.id, result }));
      } catch (e: any) {
        const err = { id: msg.id, error: { code: -32000, message: e.message } };
        enqueue(session, err);
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(err));
      }
      return;
    }

  // Graceful JSON-RPC style method not found response instead of 400 (keeps session healthy)
  const errPayload = { id: msg.id, error: { code: -32601, message: 'Method not found' } };
  enqueue(session, errPayload);
  res.writeHead(202, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(errPayload));
  }

  function enqueue(session: Session, payload: any) {
    if (!session.res) return;
    session.res.write(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
  }

  return { handleSse, handleMessage };
}
