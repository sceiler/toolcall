/**
 * toolcall - FastMCP for JavaScript
 *
 * Create MCP servers with zero boilerplate.
 *
 * @example
 * ```ts
 * import { serve, tool } from 'toolcall'
 * import { z } from 'zod'
 *
 * serve({
 *   tools: {
 *     greet: tool({
 *       description: 'Greet someone',
 *       parameters: z.object({
 *         name: z.string().describe('Name to greet')
 *       }),
 *       execute: ({ name }) => `Hello, ${name}!`
 *     }),
 *
 *     add: tool({
 *       description: 'Add two numbers',
 *       parameters: z.object({
 *         a: z.number(),
 *         b: z.number()
 *       }),
 *       execute: ({ a, b }) => a + b
 *     })
 *   }
 * })
 * ```
 */

export { serve } from './server.js'
export { tool } from './tool.js'
export { connect, McpClient } from './client.js'
export { zodToMcpSchema, toolToMcpDefinition } from './schema.js'
export type {
  ToolDefinition,
  ToolRegistry,
  ServeOptions,
  McpToolDefinition,
  McpCapabilities,
  McpServerInfo,
  JsonRpcRequest,
  JsonRpcResponse
} from './types.js'
