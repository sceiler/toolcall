# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

toolcall is a minimal library for creating MCP (Model Context Protocol) servers in TypeScript/JavaScript. It provides a two-function API (`serve()` and `tool()`) for building MCP-compliant servers with Zod schema validation.

## Commands

```bash
npm run build         # TypeScript compilation to dist/
npm run dev           # Watch mode for development
npm test              # Run all tests with Vitest
npm run test:watch    # Run tests in watch mode

# Run a single test file
npx vitest run tests/tool.test.ts

# Run example server
npx tsx examples/server.ts
```

## Architecture

The codebase follows a layered architecture with clear separation of concerns:

```
src/
├── index.ts      # Public exports: serve, tool, connect, schema utilities
├── server.ts     # MCP server implementation with JSON-RPC request handling
├── tool.ts       # Type-safe tool definition helper (identity function with generics)
├── schema.ts     # Zod-to-JSON-Schema conversion for MCP compatibility
├── transport.ts  # Stdio and HTTP transport implementations
├── client.ts     # MCP client for connecting to servers (stdio or HTTP)
└── types.ts      # TypeScript interfaces for MCP protocol structures
```

### Key Concepts

- **serve()** creates an MCP server that handles JSON-RPC 2.0 requests over stdio (default) or HTTP
- **tool()** is a type-safe identity function that preserves Zod schema inference
- **connect()** creates a client that can connect to any MCP server via command spawn or HTTP URL
- Schema conversion uses `zod-to-json-schema` with `target: 'openApi3'`

### MCP Protocol Methods Handled

- `initialize` - Returns server info and capabilities
- `notifications/initialized` - Client acknowledgment
- `tools/list` - Returns tool definitions with JSON schemas
- `tools/call` - Validates params with Zod, executes tool, returns result
- `ping` - Health check

### Transport Layer

- **Stdio**: Line-based JSON-RPC over stdin/stdout (default, used by Claude Code)
- **HTTP**: POST requests to configurable port with CORS support
