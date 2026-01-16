import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpCapabilities,
  McpServerInfo,
  ServeOptions,
  ToolRegistry
} from './types.js'
import { toolToMcpDefinition } from './schema.js'
import { createStdioTransport, createHttpTransport } from './transport.js'

const PROTOCOL_VERSION = '2024-11-05'

/**
 * Create and start an MCP server with the given tools
 *
 * @example
 * ```ts
 * import { serve, tool } from 'toolcall'
 * import { z } from 'zod'
 *
 * serve({
 *   name: 'my-server',
 *   tools: {
 *     greet: tool({
 *       description: 'Greet someone',
 *       parameters: z.object({ name: z.string() }),
 *       execute: ({ name }) => `Hello, ${name}!`
 *     })
 *   }
 * })
 * ```
 */
export function serve(
  config: ServeOptions & { tools: ToolRegistry }
): void {
  const {
    name = 'toolcall-server',
    version = '1.0.0',
    transport = 'stdio',
    port = 3000,
    tools
  } = config

  const serverInfo: McpServerInfo = { name, version }
  const capabilities: McpCapabilities = { tools: {} }

  async function handleRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { id, method, params } = request

    try {
      switch (method) {
        case 'initialize': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities,
              serverInfo
            }
          }
        }

        case 'notifications/initialized': {
          // Client acknowledged initialization - no response needed for notifications
          // but we return success anyway since some clients expect it
          return { jsonrpc: '2.0', id, result: {} }
        }

        case 'tools/list': {
          const toolList = Object.entries(tools).map(([toolName, toolDef]) =>
            toolToMcpDefinition(toolName, toolDef)
          )
          return {
            jsonrpc: '2.0',
            id,
            result: { tools: toolList }
          }
        }

        case 'tools/call': {
          const { name: toolName, arguments: args } = params as {
            name: string
            arguments?: Record<string, unknown>
          }

          const toolDef = tools[toolName]
          if (!toolDef) {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32602,
                message: `Unknown tool: ${toolName}`
              }
            }
          }

          // Validate parameters
          const parseResult = toolDef.parameters.safeParse(args ?? {})
          if (!parseResult.success) {
            return {
              jsonrpc: '2.0',
              id,
              error: {
                code: -32602,
                message: 'Invalid parameters',
                data: parseResult.error.format()
              }
            }
          }

          // Execute the tool
          const result = await toolDef.execute(parseResult.data)

          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ]
            }
          }
        }

        case 'ping': {
          return { jsonrpc: '2.0', id, result: {} }
        }

        default: {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`
            }
          }
        }
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error)
        }
      }
    }
  }

  if (transport === 'http') {
    createHttpTransport(handleRequest, port)
  } else {
    createStdioTransport(handleRequest)
  }
}
