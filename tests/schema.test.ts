import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { zodToMcpSchema, toolToMcpDefinition } from '../src/schema.js'

describe('zodToMcpSchema', () => {
  it('converts a simple object schema', () => {
    const schema = z.object({
      name: z.string()
    })

    const result = zodToMcpSchema(schema)

    expect(result.type).toBe('object')
    expect(result.properties).toHaveProperty('name')
    expect(result.required).toContain('name')
  })

  it('converts schema with multiple properties', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      active: z.boolean()
    })

    const result = zodToMcpSchema(schema)

    expect(result.type).toBe('object')
    expect(result.properties).toHaveProperty('name')
    expect(result.properties).toHaveProperty('age')
    expect(result.properties).toHaveProperty('active')
    expect(result.required).toEqual(['name', 'age', 'active'])
  })

  it('handles optional properties', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional()
    })

    const result = zodToMcpSchema(schema)

    expect(result.required).toContain('required')
    expect(result.required).not.toContain('optional')
  })

  it('handles properties with defaults', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number().default(10)
    })

    const result = zodToMcpSchema(schema)

    expect(result.properties).toHaveProperty('name')
    expect(result.properties).toHaveProperty('count')
    // Properties with defaults are not required
    expect(result.required).toContain('name')
  })

  it('handles enum types', () => {
    const schema = z.object({
      status: z.enum(['active', 'inactive', 'pending'])
    })

    const result = zodToMcpSchema(schema)

    expect(result.properties).toHaveProperty('status')
    const statusSchema = result.properties!.status as { enum: string[] }
    expect(statusSchema.enum).toEqual(['active', 'inactive', 'pending'])
  })

  it('handles array types', () => {
    const schema = z.object({
      tags: z.array(z.string())
    })

    const result = zodToMcpSchema(schema)

    expect(result.properties).toHaveProperty('tags')
    const tagsSchema = result.properties!.tags as { type: string }
    expect(tagsSchema.type).toBe('array')
  })

  it('handles nested objects', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        email: z.string()
      })
    })

    const result = zodToMcpSchema(schema)

    expect(result.properties).toHaveProperty('user')
    const userSchema = result.properties!.user as { type: string; properties: object }
    expect(userSchema.type).toBe('object')
    expect(userSchema.properties).toHaveProperty('name')
    expect(userSchema.properties).toHaveProperty('email')
  })

  it('handles number constraints', () => {
    const schema = z.object({
      value: z.number().min(0).max(100)
    })

    const result = zodToMcpSchema(schema)

    const valueSchema = result.properties!.value as { minimum: number; maximum: number }
    expect(valueSchema.minimum).toBe(0)
    expect(valueSchema.maximum).toBe(100)
  })

  it('handles string constraints', () => {
    const schema = z.object({
      text: z.string().min(1).max(50)
    })

    const result = zodToMcpSchema(schema)

    const textSchema = result.properties!.text as { minLength: number; maxLength: number }
    expect(textSchema.minLength).toBe(1)
    expect(textSchema.maxLength).toBe(50)
  })

  it('handles descriptions', () => {
    const schema = z.object({
      name: z.string().describe('The user name')
    })

    const result = zodToMcpSchema(schema)

    const nameSchema = result.properties!.name as { description: string }
    expect(nameSchema.description).toBe('The user name')
  })

  it('wraps non-object schemas in object wrapper', () => {
    const schema = z.string()

    const result = zodToMcpSchema(schema)

    expect(result.type).toBe('object')
    expect(result.properties).toHaveProperty('value')
    expect(result.required).toContain('value')
  })

  it('handles empty object schema', () => {
    const schema = z.object({})

    const result = zodToMcpSchema(schema)

    expect(result.type).toBe('object')
    expect(result.properties).toEqual({})
  })
})

describe('toolToMcpDefinition', () => {
  it('creates MCP tool definition from tool', () => {
    const tool = {
      description: 'Greet someone',
      parameters: z.object({
        name: z.string()
      }),
      execute: ({ name }: { name: string }) => `Hello, ${name}!`
    }

    const result = toolToMcpDefinition('greet', tool)

    expect(result.name).toBe('greet')
    expect(result.description).toBe('Greet someone')
    expect(result.inputSchema.type).toBe('object')
    expect(result.inputSchema.properties).toHaveProperty('name')
  })

  it('preserves parameter descriptions', () => {
    const tool = {
      description: 'Add two numbers',
      parameters: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number')
      }),
      execute: ({ a, b }: { a: number; b: number }) => a + b
    }

    const result = toolToMcpDefinition('add', tool)

    const aSchema = result.inputSchema.properties.a as { description: string }
    const bSchema = result.inputSchema.properties.b as { description: string }
    expect(aSchema.description).toBe('First number')
    expect(bSchema.description).toBe('Second number')
  })

  it('handles complex schemas', () => {
    const tool = {
      description: 'Search with options',
      parameters: z.object({
        query: z.string(),
        filters: z.object({
          category: z.enum(['a', 'b', 'c']),
          minPrice: z.number().optional()
        }).optional(),
        limit: z.number().min(1).max(100).default(10)
      }),
      execute: () => []
    }

    const result = toolToMcpDefinition('search', tool)

    expect(result.inputSchema.properties).toHaveProperty('query')
    expect(result.inputSchema.properties).toHaveProperty('filters')
    expect(result.inputSchema.properties).toHaveProperty('limit')
    expect(result.inputSchema.required).toContain('query')
  })
})
