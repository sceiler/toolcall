import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { McpToolDefinition, ToolDefinition } from './types.js'

interface JsonSchemaObject {
  type?: string
  properties?: Record<string, unknown>
  required?: string[]
  [key: string]: unknown
}

/**
 * Convert a Zod schema to MCP-compatible JSON Schema
 */
export function zodToMcpSchema(schema: z.ZodType): McpToolDefinition['inputSchema'] {
  const jsonSchema = zodToJsonSchema(schema, { target: 'openApi3' }) as JsonSchemaObject

  // Ensure we have an object schema
  if (typeof jsonSchema !== 'object' || jsonSchema.type !== 'object') {
    return {
      type: 'object',
      properties: {
        value: jsonSchema as Record<string, unknown>
      },
      required: ['value']
    }
  }

  return {
    type: 'object',
    properties: (jsonSchema.properties ?? {}) as Record<string, unknown>,
    required: jsonSchema.required
  }
}

/**
 * Convert a tool definition to MCP tool format
 */
export function toolToMcpDefinition(
  name: string,
  tool: ToolDefinition
): McpToolDefinition {
  return {
    name,
    description: tool.description,
    inputSchema: zodToMcpSchema(tool.parameters)
  }
}
