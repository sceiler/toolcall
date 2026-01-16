import * as readline from 'node:readline'
import * as http from 'node:http'
import type { JsonRpcRequest, JsonRpcResponse } from './types.js'

export type MessageHandler = (request: JsonRpcRequest) => Promise<JsonRpcResponse>

/**
 * Create a stdio transport for MCP communication
 */
export function createStdioTransport(handler: MessageHandler): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })

  rl.on('line', async (line) => {
    if (!line.trim()) return

    try {
      const request = JSON.parse(line) as JsonRpcRequest
      const response = await handler(request)
      console.log(JSON.stringify(response))
    } catch (error) {
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: -32700,
          message: 'Parse error',
          data: error instanceof Error ? error.message : String(error)
        }
      }
      console.log(JSON.stringify(errorResponse))
    }
  })

  rl.on('close', () => {
    process.exit(0)
  })
}

/**
 * Create an HTTP transport for MCP communication
 */
export function createHttpTransport(handler: MessageHandler, port: number): http.Server {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end('Method not allowed')
      return
    }

    let body = ''
    for await (const chunk of req) {
      body += chunk
    }

    try {
      const request = JSON.parse(body) as JsonRpcRequest
      const response = await handler(request)
      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify(response))
    } catch (error) {
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: 0,
        error: {
          code: -32700,
          message: 'Parse error',
          data: error instanceof Error ? error.message : String(error)
        }
      }
      res.setHeader('Content-Type', 'application/json')
      res.writeHead(200)
      res.end(JSON.stringify(errorResponse))
    }
  })

  server.listen(port, () => {
    console.error(`[toolcall] MCP server listening on http://localhost:${port}`)
  })

  return server
}
