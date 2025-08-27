// Shared type definitions for tool server responses & metrics (Item 20)

export interface ToolError {
  type: string; // 'input' | 'network' | 'timeout' | 'http' | 'auth' | 'security' | 'rate_limit' | 'read'
  message: string;
  status?: number;      // HTTP status code when relevant
  attempt?: number;     // Final attempt index (0-based) that produced this error
  retryDelayMs?: number;// Delay applied before a retry (for previous attempt)
  cause?: string;       // Low-level error code / name
}

export interface HttpResponseEnvelope {
  status: number;
  ok: boolean;
  headers: Record<string,string>;
  body?: string; // raw text (or informational placeholder for large binary)
  json?: any; // parsed JSON if available
  base64?: string; // base64 inline binary (<= threshold)
  sse?: Array<{ event?: string; data: any }>; // parsed SSE events (Item 18)
  error?: ToolError; // HTTP or processing error
  elapsedMs: number; // total time until headers/body consumed
}

export interface ToolMetricsWindow {
  calls: number;
  errors: number;
  lastCallMs: number;
  windowCount: number; // calls within current fixed window
  avgLatencyMs?: number; // computed rolling average latency (ms)
  p95LatencyMs?: number; // computed 95th percentile latency (ms)
}

export interface MetricsSnapshot { [toolName: string]: ToolMetricsWindow; }

export interface ToolDescriptor {
  name: string;
  description?: string;
  input?: any; // JSON schema for arguments
  handler: (args: any) => Promise<any>; // returns HttpResponseEnvelope-like or custom object
  security?: any; // security requirement objects (OR list) when present
}

export interface AuthCredentialMap { [schemeName: string]: any; }
