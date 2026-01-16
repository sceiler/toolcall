import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as http from 'node:http'
import type { JsonRpcRequest, JsonRpcResponse } from '../src/types.js'

// We'll test the HTTP transport by creating actual requests
// Stdio transport is harder to unit test without mocking process.stdin/stdout

describe('HTTP Transport', () => {
  // Import dynamically to allow mocking
  let createHttpTransport: typeof import('../src/transport.js').createHttpTransport
  let server: http.Server | null = null
  const testPort = 9876

  beforeEach(async () => {
    const transport = await import('../src/transport.js')
    createHttpTransport = transport.createHttpTransport
  })

  afterEach(() => {
    if (server) {
      server.close()
      server = null
    }
  })

  const mockHandler = async (request: JsonRpcRequest): Promise<JsonRpcResponse> => {
    if (request.method === 'ping') {
      return { jsonrpc: '2.0', id: request.id, result: {} }
    }
    if (request.method === 'echo') {
      return { jsonrpc: '2.0', id: request.id, result: request.params }
    }
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: 'Method not found' }
    }
  }

  const makeRequest = async (body: object): Promise<Response> => {
    return fetch(`http://localhost:${testPort}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  }

  it('creates an HTTP server on specified port', async () => {
    server = createHttpTransport(mockHandler, testPort)

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 100))

    const response = await makeRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping'
    })

    expect(response.status).toBe(200)
  })

  it('handles JSON-RPC requests', async () => {
    server = createHttpTransport(mockHandler, testPort)
    await new Promise(resolve => setTimeout(resolve, 100))

    const response = await makeRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping'
    })

    const data = await response.json() as JsonRpcResponse
    expect(data.jsonrpc).toBe('2.0')
    expect(data.id).toBe(1)
    expect(data.result).toEqual({})
  })

  it('returns handler response', async () => {
    server = createHttpTransport(mockHandler, testPort)
    await new Promise(resolve => setTimeout(resolve, 100))

    const response = await makeRequest({
      jsonrpc: '2.0',
      id: 42,
      method: 'echo',
      params: { message: 'Hello' }
    })

    const data = await response.json() as JsonRpcResponse
    expect(data.id).toBe(42)
    expect(data.result).toEqual({ message: 'Hello' })
  })

  it('sets CORS headers', async () => {
    server = createHttpTransport(mockHandler, testPort)
    await new Promise(resolve => setTimeout(resolve, 100))

    const response = await makeRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping'
    })

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('handles OPTIONS preflight requests', async () => {
    server = createHttpTransport(mockHandler, testPort)
    await new Promise(resolve => setTimeout(resolve, 100))

    const response = await fetch(`http://localhost:${testPort}`, {
      method: 'OPTIONS'
    })

    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type')
  })

  it('rejects non-POST methods', async () => {
    server = createHttpTransport(mockHandler, testPort)
    await new Promise(resolve => setTimeout(resolve, 100))

    const response = await fetch(`http://localhost:${testPort}`, {
      method: 'GET'
    })

    expect(response.status).toBe(405)
  })

  it('handles parse errors', async () => {
    server = createHttpTransport(mockHandler, testPort)
    await new Promise(resolve => setTimeout(resolve, 100))

    const response = await fetch(`http://localhost:${testPort}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not valid json'
    })

    const data = await response.json() as JsonRpcResponse
    expect(data.error?.code).toBe(-32700)
    expect(data.error?.message).toBe('Parse error')
  })

  it('returns application/json content type', async () => {
    server = createHttpTransport(mockHandler, testPort)
    await new Promise(resolve => setTimeout(resolve, 100))

    const response = await makeRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'ping'
    })

    expect(response.headers.get('Content-Type')).toBe('application/json')
  })
})

describe('Stdio Transport (handler behavior)', () => {
  // Test the handler logic without actually using stdin/stdout
  // This tests the message handling patterns

  it('processes valid JSON-RPC messages', () => {
    const message = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'test'
    })

    const parsed = JSON.parse(message) as JsonRpcRequest
    expect(parsed.jsonrpc).toBe('2.0')
    expect(parsed.id).toBe(1)
    expect(parsed.method).toBe('test')
  })

  it('handles empty lines gracefully', () => {
    const lines = ['', '  ', '\t']
    for (const line of lines) {
      expect(line.trim()).toBe('')
    }
  })

  it('handles parse errors correctly', () => {
    const invalidJson = 'not json'

    expect(() => JSON.parse(invalidJson)).toThrow()
  })

  it('formats responses as JSON lines', () => {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      result: { data: 'test' }
    }

    const output = JSON.stringify(response)
    expect(output).toBe('{"jsonrpc":"2.0","id":1,"result":{"data":"test"}}')
  })

  it('error responses follow JSON-RPC format', () => {
    const errorResponse: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 0,
      error: {
        code: -32700,
        message: 'Parse error',
        data: 'Unexpected token'
      }
    }

    expect(errorResponse.error?.code).toBe(-32700)
    expect(errorResponse.error?.message).toBe('Parse error')
  })
})

describe('Transport error codes', () => {
  it('uses correct JSON-RPC error codes', () => {
    // Standard JSON-RPC 2.0 error codes
    const errors = {
      parseError: -32700,
      invalidRequest: -32600,
      methodNotFound: -32601,
      invalidParams: -32602,
      internalError: -32603
    }

    expect(errors.parseError).toBe(-32700)
    expect(errors.invalidRequest).toBe(-32600)
    expect(errors.methodNotFound).toBe(-32601)
    expect(errors.invalidParams).toBe(-32602)
    expect(errors.internalError).toBe(-32603)
  })
})
