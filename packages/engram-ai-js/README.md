# engram-ai (TypeScript)

Long-term semantic memory for AI agents. TypeScript implementation compatible with Python [engram-ai](https://github.com/joelash/engram-ai).

## Features

- **Semantic search** via pgvector embeddings
- **Durability tiers** — core facts vs situational context vs episodic memories
- **Memory types** — facts, rules, decisions, preferences, context, observations
- **Version chains** — audit trail for memory updates
- **Temporal validity** — memories can expire
- **MCP support** — works with Claude Desktop, Cursor, etc.
- **Cross-language** — shares schema with Python engram-ai

## Installation

```bash
npm install engram-ai
# or
pnpm add engram-ai
```

## Quick Start

```typescript
import { neon } from '@neondatabase/serverless';
import { createMemoryStore, openaiEmbeddings, Durability, MemoryType } from 'engram-ai';

// Create store with Neon serverless
const sql = neon(process.env.DATABASE_URL!);
const store = createMemoryStore({
  sql,
  embeddings: openaiEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
});

// Run migrations (once)
await store.setup();

// Add a memory
await store.add(['user_123', 'preferences'], {
  text: 'User prefers dark mode',
  durability: Durability.CORE,
  memoryType: MemoryType.PREFERENCE,
});

// Search memories
const memories = await store.search(['user_123', 'preferences'], {
  query: 'UI settings',
  limit: 5,
});
```

## Embeddings Providers

```typescript
// OpenAI (default)
import { openaiEmbeddings } from 'engram-ai';
const embeddings = openaiEmbeddings();

// Via Helicone (observability)
import { heliconeEmbeddings } from 'engram-ai';
const embeddings = heliconeEmbeddings({
  heliconeKey: process.env.HELICONE_API_KEY!,
});

// Custom provider
const embeddings: EmbeddingsProvider = {
  dimensions: 1536,
  async embed(texts) {
    // Your implementation
    return texts.map(() => new Array(1536).fill(0));
  },
};
```

## MCP Server

Expose memories to Claude Desktop, Cursor, and other MCP-compatible tools:

```typescript
import { createMcpServer } from 'engram-ai/mcp';
import { createMemoryStore, openaiEmbeddings } from 'engram-ai';
import { neon } from '@neondatabase/serverless';

const store = createMemoryStore({
  sql: neon(process.env.DATABASE_URL!),
  embeddings: openaiEmbeddings(),
});

const server = createMcpServer({ 
  store,
  defaultNamespace: ['user_123'],
});

// Handle MCP messages (e.g., from stdio transport)
const response = await server.handleMessage({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'remember',
    arguments: { text: 'User prefers TypeScript', type: 'preference' },
  },
});
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `remember` | Store a new memory |
| `recall` | Search memories by semantic similarity |
| `list_memories` | List all memories with optional filters |
| `forget` | Delete a memory by ID |

## Schema

Memories have the following structure:

```typescript
interface Memory {
  id: string;
  text: string;
  durability: 'core' | 'situational' | 'episodic';
  memoryType?: 'fact' | 'rule' | 'decision' | 'preference' | 'context' | 'observation';
  confidence: number;
  source: 'explicit' | 'inferred' | 'system';
  validFrom: Date;
  validUntil?: Date;
  supersedes?: string;      // Previous version ID
  supersededBy?: string;    // Next version ID
  tags: string[];
  metadata: Record<string, unknown>;
}
```

## Cross-Language Compatibility

This package uses the same database schema as Python engram-ai. You can:

- Write memories from Python, read from TypeScript
- Share a database between Python and TypeScript services
- Migrate between languages without data changes

## License

MIT
