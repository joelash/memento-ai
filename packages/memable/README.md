# memable (TypeScript)

Long-term semantic memory for AI agents. TypeScript implementation compatible with Python [memable](https://github.com/joelash/memable).

## Features

- **Zero-config MCP** — just `npx memable` with Claude Desktop/Cursor
- **SQLite local storage** — no database setup required
- **Postgres support** — scale up when you need it
- **Semantic search** — find memories by meaning, not keywords
- **Durability tiers** — core facts vs situational context vs episodic memories
- **Version chains** — audit trail for memory updates
- **Cross-language** — shares schema with Python memable

## Quick Start: MCP Server

Add memory to Claude Desktop, Cursor, or any MCP tool — **zero config**:

```json
{
  "mcpServers": {
    "memable": {
      "command": "npx",
      "args": ["memable"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

That's it! Memories are stored locally in `~/.memable/memories.db`.

### MCP with Postgres (optional)

For cloud sync or multi-device, add `DATABASE_URL`:

```json
{
  "mcpServers": {
    "memable": {
      "command": "npx",
      "args": ["memable"],
      "env": {
        "DATABASE_URL": "postgresql://...",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `boot` | Load memory context at session start — call this first! |
| `remember` | Store a new memory |
| `recall` | Search memories by semantic similarity |
| `extract` | Auto-extract memories from conversation text |
| `list_memories` | List all memories with optional filters |
| `forget` | Delete a memory by ID |

### Recommended System Prompt

Add this to your Claude Desktop / Cursor system prompt for best results:

```
You have access to a memory system. Use your MCP tools:
- Call "boot" at the start of every conversation to load what you know
- Use "remember" to store facts, preferences, or decisions the user shares
- Use "recall" to search memories before answering personal questions
- Use "extract" to capture multiple memories from a conversation

Be proactive — if the user tells you something worth remembering, store it without being asked.
```

The `boot` tool returns:
- **Core memories** — permanent facts (always loaded)
- **Recent memories** — things learned in the last 24 hours
- **Contextual memories** — relevant to what you're discussing (if context provided)

## Installation

```bash
npm install memable
# or
pnpm add memable
```

## Programmatic Usage

### SQLite (Zero Config)

```typescript
import { SQLiteMemoryStore, openaiEmbeddings, Durability, MemoryType } from 'memable';

const store = new SQLiteMemoryStore({
  embeddings: openaiEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
  // dbPath: '~/.memable/memories.db'  // optional, this is the default
});

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

// Don't forget to close
store.close();
```

### Postgres (Neon Serverless)

```typescript
import { neon } from '@neondatabase/serverless';
import { MemoryStore, openaiEmbeddings, Durability, MemoryType } from 'memable';

const sql = neon(process.env.DATABASE_URL!);
const store = new MemoryStore({
  sql,
  embeddings: openaiEmbeddings({ apiKey: process.env.OPENAI_API_KEY }),
});

await store.setup();

// Same API as SQLite
await store.add(['user_123'], {
  text: 'User prefers dark mode',
  durability: Durability.CORE,
});
```

## Embeddings Providers

```typescript
// OpenAI (default)
import { openaiEmbeddings } from 'memable';
const embeddings = openaiEmbeddings();

// Via Helicone (observability)
import { heliconeEmbeddings } from 'memable';
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

### Local Embeddings with Ollama

For fully local operation (no OpenAI API required), use [Ollama](https://ollama.ai) with the `nomic-embed-text` model:

```bash
# Install Ollama, then pull the embedding model
ollama pull nomic-embed-text
```

Then configure a custom embeddings provider:

```typescript
const ollamaEmbeddings: EmbeddingsProvider = {
  dimensions: 768,  // nomic-embed-text dimension
  async embed(texts) {
    const results = await Promise.all(
      texts.map(async (text) => {
        const res = await fetch('http://localhost:11434/api/embeddings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
        });
        const data = await res.json();
        return data.embedding;
      })
    );
    return results;
  },
};
```

> **Note:** When switching embedding models, you'll need to re-embed existing memories since different models produce incompatible vector dimensions.
```

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

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Required for embeddings | — |
| `DATABASE_URL` | Postgres connection (optional) | Uses SQLite |
| `ENGRAM_DB_PATH` | Custom SQLite path | `~/.memable/memories.db` |
| `ENGRAM_NAMESPACE` | Default namespace (comma-separated) | `default` |

## Cross-Language Compatibility

This package uses the same database schema as Python memable. You can:

- Write memories from Python, read from TypeScript
- Share a database between Python and TypeScript services
- Migrate between languages without data changes

## License

MIT
