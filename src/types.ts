import type { z } from 'zod'

/** JSON-RPC request structure */
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown
}

/** JSON-RPC response structure */
export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

/** MCP Tool definition as returned by list_tools */
export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/** MCP Server capabilities */
export interface McpCapabilities {
  tools?: Record<string, never>
  resources?: Record<string, never>
  prompts?: Record<string, never>
}

/** MCP Server info */
export interface McpServerInfo {
  name: string
  version: string
}

/** Tool definition with Zod schema */
export interface ToolDefinition<T extends z.ZodType = z.ZodType> {
  description: string
  parameters: T
  execute: (params: z.infer<T>) => Promise<unknown> | unknown
}

/** Options for serve() */
export interface ServeOptions {
  /** Server name (shown to clients) */
  name?: string
  /** Server version */
  version?: string
  /** Transport type: 'stdio' (default) or 'http' */
  transport?: 'stdio' | 'http'
  /** Port for HTTP transport */
  port?: number
}

/** Tool registry - map of tool names to definitions */
export type ToolRegistry = Record<string, ToolDefinition>
