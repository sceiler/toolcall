import { spawn, type ChildProcess } from 'node:child_process'
import * as readline from 'node:readline'
import type { JsonRpcRequest, JsonRpcResponse, McpToolDefinition } from './types.js'

interface PendingRequest {
  resolve: (response: JsonRpcResponse) => void
  reject: (error: Error) => void
}

/**
 * MCP Client for connecting to MCP servers
 */
export class McpClient {
  private process: ChildProcess | null = null
  private httpUrl: string | null = null
  private requestId = 0
  private pendingRequests = new Map<number | string, PendingRequest>()
  private tools: McpToolDefinition[] = []

  private constructor() {}

  /**
   * Connect to an MCP server
   *
   * @param target - Either a command to spawn (e.g., 'node server.js')
   *                 or an HTTP URL (e.g., 'http://localhost:3000')
   *
   * @example
   * ```ts
   * // Connect to stdio server
   * const client = await connect('node ./my-server.js')
   *
   * // Connect to HTTP server
   * const client = await connect('http://localhost:3000')
   *
   * // Call a tool
   * const result = await client.call('greet', { name: 'World' })
   * ```
   */
  static async connect(target: string): Promise<McpClient> {
    const client = new McpClient()

    if (target.startsWith('http://') || target.startsWith('https://')) {
      client.httpUrl = target
    } else {
      // Spawn stdio process
      const [command, ...args] = target.split(' ')
      client.process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'inherit']
      })

      // Set up response handling
      const rl = readline.createInterface({
        input: client.process.stdout!,
        terminal: false
      })

      rl.on('line', (line) => {
        if (!line.trim()) return
        try {
          const response = JSON.parse(line) as JsonRpcResponse
          const pending = client.pendingRequests.get(response.id)
          if (pending) {
            client.pendingRequests.delete(response.id)
            pending.resolve(response)
          }
        } catch {
          // Ignore parse errors
        }
      })

      client.process.on('exit', () => {
        for (const pending of client.pendingRequests.values()) {
          pending.reject(new Error('Process exited'))
        }
        client.pendingRequests.clear()
      })
    }

    // Initialize connection
    await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'toolcall-client', version: '1.0.0' }
    })

    await client.request('notifications/initialized', {})

    // Get available tools
    const toolsResponse = await client.request('tools/list', {})
    client.tools = (toolsResponse.result as { tools: McpToolDefinition[] }).tools

    return client
  }

  /**
   * Send a JSON-RPC request
   */
  private async request(method: string, params: unknown): Promise<JsonRpcResponse> {
    const id = ++this.requestId
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params
    }

    if (this.httpUrl) {
      const response = await fetch(this.httpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      return response.json() as Promise<JsonRpcResponse>
    }

    if (!this.process?.stdin) {
      throw new Error('Not connected')
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })
      this.process!.stdin!.write(JSON.stringify(request) + '\n')
    })
  }

  /**
   * Call a tool by name
   */
  async call(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const response = await this.request('tools/call', {
      name: toolName,
      arguments: args
    })

    if (response.error) {
      throw new Error(response.error.message)
    }

    const result = response.result as { content: Array<{ type: string; text: string }> }
    const text = result.content[0]?.text ?? ''

    // Try to parse as JSON
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  /**
   * List available tools
   */
  listTools(): McpToolDefinition[] {
    return this.tools
  }

  /**
   * Close the connection
   */
  close(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
  }
}

/**
 * Connect to an MCP server
 */
export const connect = McpClient.connect
