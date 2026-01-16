/**
 * Example MCP server using toolcall
 *
 * Run with: npx tsx examples/server.ts
 * Or build first: npm run build && node dist/examples/server.js
 */

import { serve, tool } from '../src/index.js'
import { z } from 'zod'

serve({
  name: 'example-server',
  version: '1.0.0',
  tools: {
    greet: tool({
      description: 'Greet someone by name',
      parameters: z.object({
        name: z.string().describe('The name of the person to greet')
      }),
      execute: ({ name }) => `Hello, ${name}!`
    }),

    add: tool({
      description: 'Add two numbers together',
      parameters: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number')
      }),
      execute: ({ a, b }) => ({ result: a + b })
    }),

    get_weather: tool({
      description: 'Get the current weather for a city',
      parameters: z.object({
        city: z.string().describe('City name'),
        unit: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature unit')
      }),
      execute: async ({ city, unit }) => {
        // Simulated weather data
        const temp = Math.round(Math.random() * 30 + 10)
        const tempInUnit = unit === 'fahrenheit' ? Math.round(temp * 9 / 5 + 32) : temp
        return {
          city,
          temperature: tempInUnit,
          unit,
          condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)]
        }
      }
    }),

    search: tool({
      description: 'Search for information',
      parameters: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().min(1).max(100).default(10).describe('Maximum results')
      }),
      execute: async ({ query, limit }) => {
        // Simulated search results
        return {
          query,
          results: Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
            title: `Result ${i + 1} for "${query}"`,
            url: `https://example.com/result/${i + 1}`
          }))
        }
      }
    })
  }
})
