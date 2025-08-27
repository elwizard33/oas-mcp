import crypto from 'node:crypto';
import type { MCPServer } from './mcpServer.js';

/** Parse text/event-stream payload into array of event objects */
export function parseSSE(rawText: string) {
  const events: any[] = [];
  const blocks = rawText.split(/\n\n+/);
  for (const blk of blocks) {
    if (!blk.trim()) continue;
    let eventType: string | undefined; const dataLines: string[] = [];
    for (const line of blk.split(/\n/)) {
      if (line.startsWith('event:')) eventType = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) {
      const dataRaw = dataLines.join('\n');
      let parsed: any = dataRaw;
      try { parsed = JSON.parse(dataRaw); } catch { /* leave as string */ }
      events.push(eventType ? { event: eventType, data: parsed } : { data: parsed });
    }
  }
  return events;
}

/**
 * Stream a fetch Response body emitting chunk events. Returns the envelope referencing streamId.
 * Mirrors original inline logic (no behavior change intended).
 */
export async function streamResponse(server: MCPServer, resp: Response, toolName: string, elapsedMs: number, headersObj: Record<string,string>, debug: boolean) {
  const contentType = resp.headers.get('content-type') || '';
  const streamId = 'str_' + crypto.randomUUID();
  (server as any).emitStreamEvent({ streamId, event: 'start', data: { status: resp.status, ok: resp.ok, headers: headersObj, contentType } });
  let total = 0;
  try {
    const reader = (resp.body as any).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length) {
        total += value.length;
        (server as any).emitStreamEvent({ streamId, event: 'chunk', data: { base64: Buffer.from(value).toString('base64') } });
      }
    }
    (server as any).emitStreamEvent({ streamId, event: 'end', data: { totalBytes: total, status: resp.status, ok: resp.ok } });
  } catch (e: any) {
    (server as any).emitStreamEvent({ streamId, event: 'error', data: { message: e.message } });
  }
  (server as any).record(toolName, resp.ok, elapsedMs);
  if (debug) console.log(`[tool:${toolName}] <- ${resp.status} streamed (${elapsedMs}ms)`);
  return { status: resp.status, ok: resp.ok, headers: headersObj, streaming: true, streamId, elapsedMs } as any;
}
