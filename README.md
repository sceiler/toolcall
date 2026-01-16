# toolcall

Create MCP (Model Context Protocol) servers with zero boilerplate.

[![npm version](https://badge.fury.io/js/toolcall.svg)](https://www.npmjs.com/package/toolcall)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Minimal API** - Just two functions: `serve()` and `tool()`
- **Type-safe** - Full TypeScript support with Zod schema validation
- **Multiple transports** - Supports both stdio and HTTP
- **MCP compliant** - Implements MCP protocol version `2024-11-05`
- **Client included** - Connect to any MCP server programmatically

## Installation

```bash
npm install toolcall zod
```

## Quick Start

Create an MCP server in just a few lines:

```typescript
import { serve, tool } from 'toolcall'
import { z } from 'zod'

serve({
  name: 'my-server',
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
      description: 'Add two numbers',
      parameters: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number')
      }),
      execute: ({ a, b }) => ({ result: a + b })
    })
  }
})
```

Run it:

```bash
npx tsx server.ts
```

## Claude Code Integration

toolcall servers integrate seamlessly with [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Add your server to Claude Code's MCP configuration:

### 1. Create your server file

```typescript
// my-tools.ts
import { serve, tool } from 'toolcall'
import { z } from 'zod'

serve({
  name: 'my-tools',
  tools: {
    get_weather: tool({
      description: 'Get current weather for a city',
      parameters: z.object({
        city: z.string().describe('City name'),
        unit: z.enum(['celsius', 'fahrenheit']).default('celsius')
      }),
      execute: async ({ city, unit }) => {
        // Your implementation here
        return { city, temperature: 22, unit, condition: 'sunny' }
      }
    })
  }
})
```

### 2. Configure Claude Code

Add to your Claude Code MCP settings (`~/.claude/claude_desktop_config.json` or via Claude Code settings):

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "npx",
      "args": ["tsx", "/path/to/my-tools.ts"]
    }
  }
}
```

Or if you've compiled your TypeScript:

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["/path/to/my-tools.js"]
    }
  }
}
```

### 3. Use in Claude Code

Once configured, Claude Code will automatically discover your tools. You can ask Claude to use them:

> "Use my get_weather tool to check the weather in Tokyo"

## API Reference

### `serve(options)`

Creates and starts an MCP server.

```typescript
serve({
  name: 'my-server',        // Server name (default: 'toolcall-server')
  version: '1.0.0',         // Server version (default: '1.0.0')
  transport: 'stdio',       // Transport type: 'stdio' | 'http' (default: 'stdio')
  port: 3000,               // Port for HTTP transport (default: 3000)
  tools: {                  // Tool definitions
    // ... your tools
  }
})
```

### `tool(definition)`

Defines a type-safe tool with Zod schema validation.

```typescript
tool({
  description: 'Tool description shown to clients',
  parameters: z.object({
    // Zod schema for parameters
  }),
  execute: async (params) => {
    // Tool implementation
    // Can return string, object, or any JSON-serializable value
  }
})
```

### Parameter Types

toolcall supports all Zod types:

```typescript
import { z } from 'zod'

// Strings
z.string()
z.string().min(1).max(100)
z.string().email()
z.string().url()

// Numbers
z.number()
z.number().min(0).max(100)
z.number().int()

// Booleans
z.boolean()

// Enums
z.enum(['option1', 'option2', 'option3'])

// Arrays
z.array(z.string())

// Optional with defaults
z.string().optional()
z.number().default(10)

// Descriptions (shown in tool schema)
z.string().describe('Parameter description')
```

### Return Values

Tools can return any JSON-serializable value:

```typescript
// String return
execute: ({ name }) => `Hello, ${name}!`

// Object return (automatically JSON-stringified)
execute: ({ a, b }) => ({ result: a + b, operation: 'addition' })

// Async operations
execute: async ({ url }) => {
  const response = await fetch(url)
  return await response.json()
}
```

## Transports

### Stdio (Default)

The stdio transport reads JSON-RPC messages from stdin and writes responses to stdout. This is the standard transport for MCP servers used by Claude Code and other MCP clients.

```typescript
serve({
  transport: 'stdio',  // or omit - stdio is default
  tools: { /* ... */ }
})
```

### HTTP

The HTTP transport creates an HTTP server that accepts JSON-RPC POST requests.

```typescript
serve({
  transport: 'http',
  port: 3000,
  tools: { /* ... */ }
})
```

Test with curl:

```bash
# Initialize
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}'

# List tools
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'

# Call a tool
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"greet","arguments":{"name":"World"}}}'
```

## Client Usage

toolcall includes a client for connecting to any MCP server:

```typescript
import { connect } from 'toolcall'

// Connect to a stdio server
const client = await connect('npx tsx ./server.ts')

// Or connect to an HTTP server
const client = await connect('http://localhost:3000')

// List available tools
console.log(client.listTools())

// Call a tool
const result = await client.call('greet', { name: 'World' })
console.log(result)  // "Hello, World!"

// Clean up
client.close()
```

## Complete Example

```typescript
import { serve, tool } from 'toolcall'
import { z } from 'zod'

serve({
  name: 'example-server',
  version: '1.0.0',
  tools: {
    // Simple string return
    greet: tool({
      description: 'Greet someone by name',
      parameters: z.object({
        name: z.string().describe('The name of the person to greet')
      }),
      execute: ({ name }) => `Hello, ${name}!`
    }),

    // Object return
    add: tool({
      description: 'Add two numbers together',
      parameters: z.object({
        a: z.number().describe('First number'),
        b: z.number().describe('Second number')
      }),
      execute: ({ a, b }) => ({ result: a + b })
    }),

    // Async with enum and default
    get_weather: tool({
      description: 'Get the current weather for a city',
      parameters: z.object({
        city: z.string().describe('City name'),
        unit: z.enum(['celsius', 'fahrenheit']).default('celsius').describe('Temperature unit')
      }),
      execute: async ({ city, unit }) => {
        // Simulate API call
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

    // Constrained parameters
    search: tool({
      description: 'Search for information',
      parameters: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().min(1).max(100).default(10).describe('Maximum results')
      }),
      execute: async ({ query, limit }) => {
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
```

## Error Handling

toolcall automatically validates parameters against your Zod schemas. Invalid parameters return a JSON-RPC error:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid parameters",
    "data": {
      "name": { "_errors": ["Required"] }
    }
  }
}
```

Errors thrown in tool execution are caught and returned as internal errors:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error",
    "data": "Error message here"
  }
}
```

## Protocol Details

toolcall implements the [Model Context Protocol](https://modelcontextprotocol.io/) specification:

- **Protocol Version**: `2024-11-05`
- **Transport**: JSON-RPC 2.0 over stdio or HTTP
- **Methods**:
  - `initialize` - Server initialization handshake
  - `notifications/initialized` - Client initialization acknowledgment
  - `tools/list` - List available tools
  - `tools/call` - Execute a tool
  - `ping` - Health check

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run example server
npx tsx examples/server.ts

# Run tests
npm test
```

## License

MIT

## Author

Yi Min Yang (https://www.yiminyang.dev)
