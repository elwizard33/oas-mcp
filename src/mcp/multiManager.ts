import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { buildMcpSdkServer } from './sdkFactory.js';
import { parseRequestParams } from '../util/params.js';

interface ManagedEntry { id: string; server: McpServer; params: any; }

export class MultiServerManager {
  private servers = new Map<string, ManagedEntry>();
  private persistPath: string;
  constructor(private debug = false, storagePath?: string) {
    this.persistPath = storagePath || process.env.OAS_MCP_SERVER_REGISTRY || '.oas-mcp-servers.json';
    this.loadPersisted().catch(()=>{/* ignore */});
  }
  list() { return [...this.servers.values()].map(s => ({ id: s.id, baseURL: s.params.baseURL, schemaURL: s.params.schemaURL })); }
  get(id: string) { return this.servers.get(id); }
  private async loadPersisted() {
    try {
      const { readFile } = await import('fs/promises');
      const txt = await readFile(this.persistPath, 'utf8');
      const arr = JSON.parse(txt);
      if (Array.isArray(arr)) {
        for (const rec of arr) {
          if (rec && rec.schemaURL && rec.baseURL) {
            try {
              await this.add({ schemaURL: rec.schemaURL, baseURL: rec.baseURL, serverName: rec.serverName });
            } catch {/* ignore individual */}
          }
        }
      }
    } catch {/* no persisted file */}
  }
  private async persist() {
    try {
      const { writeFile } = await import('fs/promises');
      const arr = [...this.servers.values()].map(s => ({ schemaURL: s.params.schemaURL, baseURL: s.params.baseURL, serverName: s.params.serverName }));
      await writeFile(this.persistPath, JSON.stringify(arr, null, 2), 'utf8');
    } catch {/* ignore */}
  }
  async add(raw: { schemaURL: string; baseURL: string; serverName?: string }) {
    const parsed = await parseRequestParams({ s: raw.schemaURL, u: raw.baseURL, n: raw.serverName });
    const { server, id } = await buildMcpSdkServer(parsed as any, { debug: this.debug, allowFile: true });
    this.servers.set(id, { id, server, params: parsed });
    await this.persist();
    return id;
  }
  async remove(id: string) { const ent = this.servers.get(id); if (!ent) return false; try { await (ent.server as any).close?.(); } catch {/* ignore */} this.servers.delete(id); await this.persist(); return true; }
}

export function registerManagementTools(root: McpServer, mgr: MultiServerManager) {
  root.registerTool('oas_list_servers', { title: 'List Managed OpenAPI Servers' }, async () => ({ content: [{ type: 'text', text: JSON.stringify(mgr.list(), null, 2) }] }));
  root.registerTool('oas_add_server', { title: 'Add OpenAPI Server', inputSchema: { schemaURL: (undefined as any), baseURL: (undefined as any), serverName: (undefined as any) } }, async (args: any) => {
    if (!args.schemaURL || !args.baseURL) return { content:[{ type:'text', text:'schemaURL & baseURL required'}], isError:true };
    const id = await mgr.add({ schemaURL: args.schemaURL, baseURL: args.baseURL, serverName: args.serverName });
    return { content:[{ type:'text', text:`added ${id}` }] };
  });
  root.registerTool('oas_remove_server', { title: 'Remove OpenAPI Server', inputSchema: { id: (undefined as any) } }, async (args: any) => {
    if (!args.id) return { content:[{ type:'text', text:'id required'}], isError:true };
    const ok = await mgr.remove(args.id);
    return { content:[{ type:'text', text: ok ? 'removed' : 'not found' }] };
  });
}
