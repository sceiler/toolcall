import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { tool } from '../src/tool.js'

describe('tool', () => {
  it('returns the same definition object', () => {
    const definition = {
      description: 'Test tool',
      parameters: z.object({
        value: z.string()
      }),
      execute: ({ value }: { value: string }) => value
    }

    const result = tool(definition)

    expect(result).toBe(definition)
  })

  it('preserves description', () => {
    const result = tool({
      description: 'My custom description',
      parameters: z.object({}),
      execute: () => 'result'
    })

    expect(result.description).toBe('My custom description')
  })

  it('preserves parameters schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number()
    })

    const result = tool({
      description: 'Test',
      parameters: schema,
      execute: () => 'result'
    })

    expect(result.parameters).toBe(schema)
  })

  it('preserves execute function', () => {
    const executeFn = ({ x }: { x: number }) => x * 2

    const result = tool({
      description: 'Multiply',
      parameters: z.object({ x: z.number() }),
      execute: executeFn
    })

    expect(result.execute).toBe(executeFn)
  })

  it('works with sync execute functions', () => {
    const testTool = tool({
      description: 'Sync test',
      parameters: z.object({
        value: z.string()
      }),
      execute: ({ value }) => `Result: ${value}`
    })

    const result = testTool.execute({ value: 'test' })
    expect(result).toBe('Result: test')
  })

  it('works with async execute functions', async () => {
    const testTool = tool({
      description: 'Async test',
      parameters: z.object({
        value: z.number()
      }),
      execute: async ({ value }) => {
        return { doubled: value * 2 }
      }
    })

    const result = await testTool.execute({ value: 5 })
    expect(result).toEqual({ doubled: 10 })
  })

  it('supports various parameter types', () => {
    const testTool = tool({
      description: 'Multi-type params',
      parameters: z.object({
        str: z.string(),
        num: z.number(),
        bool: z.boolean(),
        arr: z.array(z.string()),
        opt: z.string().optional()
      }),
      execute: (params) => params
    })

    const result = testTool.execute({
      str: 'hello',
      num: 42,
      bool: true,
      arr: ['a', 'b']
    })

    expect(result).toEqual({
      str: 'hello',
      num: 42,
      bool: true,
      arr: ['a', 'b']
    })
  })

  it('supports object returns', () => {
    const testTool = tool({
      description: 'Object return',
      parameters: z.object({
        a: z.number(),
        b: z.number()
      }),
      execute: ({ a, b }) => ({
        sum: a + b,
        product: a * b,
        difference: a - b
      })
    })

    const result = testTool.execute({ a: 10, b: 3 })
    expect(result).toEqual({
      sum: 13,
      product: 30,
      difference: 7
    })
  })

  it('supports string returns', () => {
    const testTool = tool({
      description: 'String return',
      parameters: z.object({
        name: z.string()
      }),
      execute: ({ name }) => `Hello, ${name}!`
    })

    const result = testTool.execute({ name: 'World' })
    expect(result).toBe('Hello, World!')
  })

  it('supports array returns', () => {
    const testTool = tool({
      description: 'Array return',
      parameters: z.object({
        count: z.number()
      }),
      execute: ({ count }) => Array.from({ length: count }, (_, i) => i + 1)
    })

    const result = testTool.execute({ count: 5 })
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('supports null/undefined returns', () => {
    const nullTool = tool({
      description: 'Null return',
      parameters: z.object({}),
      execute: () => null
    })

    const undefinedTool = tool({
      description: 'Undefined return',
      parameters: z.object({}),
      execute: () => undefined
    })

    expect(nullTool.execute({})).toBeNull()
    expect(undefinedTool.execute({})).toBeUndefined()
  })

  it('supports default parameter values via Zod', () => {
    const testTool = tool({
      description: 'Defaults test',
      parameters: z.object({
        required: z.string(),
        withDefault: z.number().default(42)
      }),
      execute: (params) => params
    })

    // Note: The actual default value application happens during schema parsing
    // This test validates the tool definition structure
    expect(testTool.parameters._def).toBeDefined()
  })

  it('supports enum parameters', () => {
    const testTool = tool({
      description: 'Enum test',
      parameters: z.object({
        status: z.enum(['active', 'inactive', 'pending'])
      }),
      execute: ({ status }) => `Status is: ${status}`
    })

    const result = testTool.execute({ status: 'active' })
    expect(result).toBe('Status is: active')
  })
})
