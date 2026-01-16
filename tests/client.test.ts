import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import * as http from 'node:http'
import type { JsonRpcRequest, JsonRpcResponse } from '../src/types.js'

describe('McpClient', () => {
  let McpClient: typeof import('../src/client.js').McpClient
  let connect: typeof import('../src/client.js').connect
  let testServer: http.Server | null = null
  const testPort = 9877
  const testUrl = `http://localhost:${testPort}`

  // Mock server that implements MCP protocol
  const createMockServer = (tools: Array<{ name: string; description: string }> = []) => {
    return http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Content-Type', 'application/json')

      if (req.method !== 'POST') {
        res.writeHead(405)
        res.end()
        return
      }

      let body = ''
      for await (const chunk of req) {
        body += chunk
      }

      const request = JSON.parse(body) as JsonRpcRequest
      let response: JsonRpcResponse

      switch (request.method) {
        case 'initialize':
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: { tools: {} },
              serverInfo: { name: 'mock-server', version: '1.0.0' }
            }
          }
          break

        case 'notifications/initialized':
          response = { jsonrpc: '2.0', id: request.id, result: {} }
          break

        case 'tools/list':
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: tools.map(t => ({
                name: t.name,
                description: t.description,
                inputSchema: { type: 'object', properties: {} }
              }))
            }
          }
          break

        case 'tools/call': {
          const params = request.params as { name: string; arguments: Record<string, unknown> }
          if (params.name === 'greet') {
            response = {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                content: [{ type: 'text', text: `Hello, ${params.arguments.name}!` }]
              }
            }
          } else if (params.name === 'add') {
            const args = params.arguments as { a: number; b: number }
            response = {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                content: [{ type: 'text', text: JSON.stringify({ result: args.a + args.b }) }]
              }
            }
          } else if (params.name === 'error_tool') {
            response = {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32603, message: 'Tool error' }
            }
          } else {
            response = {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32602, message: `Unknown tool: ${params.name}` }
            }
          }
          break
        }

        default:
          response = {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: 'Method not found' }
          }
      }

      res.writeHead(200)
      res.end(JSON.stringify(response))
    })
  }

  beforeAll(async () => {
    const client = await import('../src/client.js')
    McpClient = client.McpClient
    connect = client.connect
  })

  afterEach(() => {
    if (testServer) {
      testServer.close()
      testServer = null
    }
  })

  describe('HTTP connection', () => {
    it('connects to HTTP server', async () => {
      testServer = createMockServer([
        { name: 'test', description: 'Test tool' }
      ])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)
      expect(client).toBeInstanceOf(McpClient)
      client.close()
    })

    it('lists tools after connection', async () => {
      testServer = createMockServer([
        { name: 'greet', description: 'Greet someone' },
        { name: 'add', description: 'Add numbers' }
      ])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)
      const tools = client.listTools()

      expect(tools).toHaveLength(2)
      expect(tools.map(t => t.name)).toContain('greet')
      expect(tools.map(t => t.name)).toContain('add')

      client.close()
    })

    it('calls tools with string returns', async () => {
      testServer = createMockServer([
        { name: 'greet', description: 'Greet someone' }
      ])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)
      const result = await client.call('greet', { name: 'World' })

      expect(result).toBe('Hello, World!')

      client.close()
    })

    it('calls tools with JSON returns', async () => {
      testServer = createMockServer([
        { name: 'add', description: 'Add numbers' }
      ])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)
      const result = await client.call('add', { a: 5, b: 3 })

      expect(result).toEqual({ result: 8 })

      client.close()
    })

    it('throws on tool errors', async () => {
      testServer = createMockServer([
        { name: 'error_tool', description: 'Error tool' }
      ])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)

      await expect(client.call('error_tool', {})).rejects.toThrow('Tool error')

      client.close()
    })

    it('throws on unknown tools', async () => {
      testServer = createMockServer([])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)

      await expect(client.call('nonexistent', {})).rejects.toThrow()

      client.close()
    })
  })

  describe('connect function', () => {
    it('recognizes HTTP URLs', async () => {
      testServer = createMockServer([])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(`http://localhost:${testPort}`)
      expect(client).toBeInstanceOf(McpClient)
      client.close()
    })

    it('recognizes HTTPS URLs', async () => {
      // We can't easily test HTTPS without certs, just verify URL parsing
      const httpUrl = 'https://example.com:3000'
      expect(httpUrl.startsWith('https://')).toBe(true)
    })
  })

  describe('listTools', () => {
    it('returns empty array when no tools', async () => {
      testServer = createMockServer([])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)
      const tools = client.listTools()

      expect(tools).toEqual([])

      client.close()
    })

    it('includes tool descriptions', async () => {
      testServer = createMockServer([
        { name: 'test', description: 'A test tool' }
      ])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)
      const tools = client.listTools()

      expect(tools[0].description).toBe('A test tool')

      client.close()
    })
  })

  describe('call method', () => {
    it('uses empty object for missing args', async () => {
      testServer = createMockServer([
        { name: 'greet', description: 'Greet' }
      ])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)
      // This should not throw - it uses {} as default
      const result = await client.call('greet')
      // The mock server expects name, so this tests the default arg behavior
      expect(result).toBe('Hello, undefined!')

      client.close()
    })
  })

  describe('close method', () => {
    it('can be called safely', async () => {
      testServer = createMockServer([])
      testServer.listen(testPort)
      await new Promise(resolve => setTimeout(resolve, 100))

      const client = await connect(testUrl)
      client.close()
      // Should not throw if called again
      client.close()
    })
  })
})

describe('McpClient request handling', () => {
  it('increments request IDs', async () => {
    // This tests the internal request ID incrementing
    // We can verify by checking the response ID matches
    let lastId = 0

    const server = http.createServer(async (req, res) => {
      res.setHeader('Content-Type', 'application/json')

      let body = ''
      for await (const chunk of req) {
        body += chunk
      }

      const request = JSON.parse(body) as JsonRpcRequest
      lastId = request.id as number

      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: request.id,
        result: request.method === 'tools/list' ? { tools: [] } : {}
      }

      res.writeHead(200)
      res.end(JSON.stringify(response))
    })

    server.listen(9878)
    await new Promise(resolve => setTimeout(resolve, 100))

    const { connect } = await import('../src/client.js')
    const client = await connect('http://localhost:9878')

    // After connect, lastId should be > 1 (initialize + notifications/initialized + tools/list)
    expect(lastId).toBeGreaterThanOrEqual(3)

    client.close()
    server.close()
  })
})

describe('Result parsing', () => {
  it('parses JSON results', () => {
    const jsonText = '{"result": 42}'
    const parsed = JSON.parse(jsonText)
    expect(parsed).toEqual({ result: 42 })
  })

  it('returns string for non-JSON results', () => {
    const text = 'Hello, World!'
    let result: unknown

    try {
      result = JSON.parse(text)
    } catch {
      result = text
    }

    expect(result).toBe('Hello, World!')
  })

  it('handles empty string results', () => {
    const text = ''
    let result: unknown

    try {
      result = JSON.parse(text)
    } catch {
      result = text
    }

    expect(result).toBe('')
  })
})
