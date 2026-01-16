import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'
import { tool } from '../src/tool.js'
import type { JsonRpcRequest, JsonRpcResponse, ToolRegistry } from '../src/types.js'
import { toolToMcpDefinition } from '../src/schema.js'

// Create a test harness that mimics the server's handleRequest function
function createTestServer(tools: ToolRegistry) {
  const PROTOCOL_VERSION = '2024-11-05'
  const serverInfo = { name: 'test-server', version: '1.0.0' }
  const capabilities = { tools: {} }

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

  return { handleRequest }
}

describe('MCP Server', () => {
  const testTools: ToolRegistry = {
    greet: tool({
      description: 'Greet someone',
      parameters: z.object({
        name: z.string().describe('Name to greet')
      }),
      execute: ({ name }) => `Hello, ${name}!`
    }),
    add: tool({
      description: 'Add two numbers',
      parameters: z.object({
        a: z.number(),
        b: z.number()
      }),
      execute: ({ a, b }) => ({ result: a + b })
    }),
    async_tool: tool({
      description: 'Async tool',
      parameters: z.object({
        value: z.string()
      }),
      execute: async ({ value }) => {
        return { processed: value.toUpperCase() }
      }
    }),
    error_tool: tool({
      description: 'Tool that throws',
      parameters: z.object({}),
      execute: () => {
        throw new Error('Intentional error')
      }
    })
  }

  let server: ReturnType<typeof createTestServer>

  beforeEach(() => {
    server = createTestServer(testTools)
  })

  describe('initialize', () => {
    it('returns protocol version and capabilities', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {}
        }
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toMatchObject({
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'test-server',
          version: '1.0.0'
        }
      })
    })

    it('preserves request id', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 'custom-id-123',
        method: 'initialize',
        params: {}
      })

      expect(response.id).toBe('custom-id-123')
    })
  })

  describe('notifications/initialized', () => {
    it('returns empty success response', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'notifications/initialized',
        params: {}
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toEqual({})
    })
  })

  describe('tools/list', () => {
    it('returns all registered tools', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })

      expect(response.error).toBeUndefined()
      const result = response.result as { tools: Array<{ name: string; description: string }> }
      expect(result.tools).toHaveLength(4)

      const toolNames = result.tools.map(t => t.name)
      expect(toolNames).toContain('greet')
      expect(toolNames).toContain('add')
      expect(toolNames).toContain('async_tool')
      expect(toolNames).toContain('error_tool')
    })

    it('includes tool descriptions', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })

      const result = response.result as { tools: Array<{ name: string; description: string }> }
      const greetTool = result.tools.find(t => t.name === 'greet')
      expect(greetTool?.description).toBe('Greet someone')
    })

    it('includes input schemas', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })

      const result = response.result as {
        tools: Array<{
          name: string
          inputSchema: { type: string; properties: Record<string, unknown> }
        }>
      }
      const addTool = result.tools.find(t => t.name === 'add')
      expect(addTool?.inputSchema.type).toBe('object')
      expect(addTool?.inputSchema.properties).toHaveProperty('a')
      expect(addTool?.inputSchema.properties).toHaveProperty('b')
    })
  })

  describe('tools/call', () => {
    it('executes tool with valid parameters', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'greet',
          arguments: { name: 'World' }
        }
      })

      expect(response.error).toBeUndefined()
      const result = response.result as { content: Array<{ type: string; text: string }> }
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toBe('Hello, World!')
    })

    it('returns JSON-stringified object results', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'add',
          arguments: { a: 5, b: 3 }
        }
      })

      expect(response.error).toBeUndefined()
      const result = response.result as { content: Array<{ type: string; text: string }> }
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual({ result: 8 })
    })

    it('handles async tools', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'async_tool',
          arguments: { value: 'hello' }
        }
      })

      expect(response.error).toBeUndefined()
      const result = response.result as { content: Array<{ type: string; text: string }> }
      const parsed = JSON.parse(result.content[0].text)
      expect(parsed).toEqual({ processed: 'HELLO' })
    })

    it('returns error for unknown tool', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'nonexistent',
          arguments: {}
        }
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32602)
      expect(response.error?.message).toBe('Unknown tool: nonexistent')
    })

    it('returns error for invalid parameters', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'greet',
          arguments: { name: 123 } // Should be string
        }
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32602)
      expect(response.error?.message).toBe('Invalid parameters')
    })

    it('returns error for missing required parameters', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'greet',
          arguments: {} // Missing 'name'
        }
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32602)
      expect(response.error?.message).toBe('Invalid parameters')
    })

    it('handles tool execution errors', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'error_tool',
          arguments: {}
        }
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32603)
      expect(response.error?.message).toBe('Internal error')
      expect(response.error?.data).toBe('Intentional error')
    })

    it('handles missing arguments by using empty object', async () => {
      const emptyServer = createTestServer({
        no_args: tool({
          description: 'Tool with no args',
          parameters: z.object({}),
          execute: () => 'success'
        })
      })

      const response = await emptyServer.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'no_args'
          // No arguments field
        }
      })

      expect(response.error).toBeUndefined()
      const result = response.result as { content: Array<{ type: string; text: string }> }
      expect(result.content[0].text).toBe('success')
    })
  })

  describe('ping', () => {
    it('returns empty success response', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {}
      })

      expect(response.error).toBeUndefined()
      expect(response.result).toEqual({})
    })
  })

  describe('unknown methods', () => {
    it('returns method not found error', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown/method',
        params: {}
      })

      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe(-32601)
      expect(response.error?.message).toBe('Method not found: unknown/method')
    })
  })

  describe('JSON-RPC compliance', () => {
    it('always includes jsonrpc version in response', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'ping'
      })

      expect(response.jsonrpc).toBe('2.0')
    })

    it('handles string request IDs', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 'string-id',
        method: 'ping'
      })

      expect(response.id).toBe('string-id')
    })

    it('handles numeric request IDs', async () => {
      const response = await server.handleRequest({
        jsonrpc: '2.0',
        id: 42,
        method: 'ping'
      })

      expect(response.id).toBe(42)
    })
  })
})

describe('Server with different tool configurations', () => {
  it('handles server with no tools', async () => {
    const server = createTestServer({})

    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    })

    expect(response.error).toBeUndefined()
    const result = response.result as { tools: unknown[] }
    expect(result.tools).toEqual([])
  })

  it('handles tools with complex schemas', async () => {
    const server = createTestServer({
      complex: tool({
        description: 'Complex tool',
        parameters: z.object({
          nested: z.object({
            value: z.string()
          }),
          list: z.array(z.number()),
          optional: z.string().optional(),
          withDefault: z.number().default(10)
        }),
        execute: (params) => params
      })
    })

    const response = await server.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'complex',
        arguments: {
          nested: { value: 'test' },
          list: [1, 2, 3]
        }
      }
    })

    expect(response.error).toBeUndefined()
    const result = response.result as { content: Array<{ type: string; text: string }> }
    const parsed = JSON.parse(result.content[0].text)
    expect(parsed.nested.value).toBe('test')
    expect(parsed.list).toEqual([1, 2, 3])
    expect(parsed.withDefault).toBe(10)
  })
})
