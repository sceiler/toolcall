import { z } from 'zod'
import type { ToolDefinition } from './types.js'

/**
 * Define a tool with type-safe parameters
 *
 * @example
 * ```ts
 * const getWeather = tool({
 *   description: 'Get weather for a city',
 *   parameters: z.object({
 *     city: z.string().describe('City name'),
 *     unit: z.enum(['celsius', 'fahrenheit']).default('celsius')
 *   }),
 *   execute: async ({ city, unit }) => {
 *     // Implementation
 *     return { temperature: 22, unit }
 *   }
 * })
 * ```
 */
export function tool<T extends z.ZodType>(
  definition: ToolDefinition<T>
): ToolDefinition<T> {
  return definition
}
