# Ollama Embeddings Integration Spec

## Goal

Enable fully local mode without requiring OpenAI API keys by using Ollama for embeddings.

## Overview

When running `npx memable` in local mode, detect if Ollama is available and use it for embeddings instead of OpenAI. This makes local mode truly local with zero external API dependencies.

## Embedding Model

**Recommended:** `nomic-embed-text`
- Good quality (~90% of OpenAI text-embedding-3-small)
- 768 dimensions
- Fast inference
- Widely used in local-first community

**Fallback:** `all-minilm` (if user has it)

## Detection Logic

**Priority order (explicit config beats auto-detect):**

```
1. MEMABLE_EMBEDDINGS=ollama → force Ollama
2. MEMABLE_EMBEDDINGS=openai → force OpenAI  
3. OPENAI_API_KEY set in MCP config → use OpenAI (user's explicit intent)
4. Auto-detect (only if no explicit key):
   a. Check if Ollama is running: GET http://localhost:11434/api/tags
   b. If yes, check if nomic-embed-text is available
   c. If model available → use Ollama
   d. If Ollama running but model missing → prompt user to pull it
   e. If no Ollama → error with helpful message
```

**Rationale:** If user explicitly sets `OPENAI_API_KEY` in their MCP config, they want OpenAI even if Ollama is running. Respect explicit intent.

## Ollama API

**Endpoint:** `POST http://localhost:11434/api/embeddings`

**Request:**
```json
{
  "model": "nomic-embed-text",
  "prompt": "text to embed"
}
```

**Response:**
```json
{
  "embedding": [0.1, 0.2, ...]
}
```

## Implementation

### 1. New file: `packages/memable/src/embeddings-ollama.ts`

```typescript
interface OllamaEmbeddings {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

const OLLAMA_URL = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MODEL = 'nomic-embed-text';

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function hasEmbeddingModel(model = DEFAULT_MODEL): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await res.json();
    return data.models?.some((m: any) => m.name.startsWith(model));
  } catch {
    return false;
  }
}

export function createOllamaEmbeddings(model = DEFAULT_MODEL): OllamaEmbeddings {
  return {
    async embed(text: string): Promise<number[]> {
      const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      });
      
      if (!res.ok) {
        throw new Error(`Ollama embedding failed: ${res.statusText}`);
      }
      
      const data = await res.json();
      return data.embedding;
    },
    
    async embedBatch(texts: string[]): Promise<number[][]> {
      // Ollama doesn't have native batch, so we parallelize
      return Promise.all(texts.map(t => this.embed(t)));
    },
  };
}
```

### 2. Update `packages/memable/src/embeddings.ts`

Add provider selection logic:

```typescript
export type EmbeddingProvider = 'openai' | 'ollama' | 'auto';

export async function createEmbeddings(
  provider: EmbeddingProvider = 'auto'
): Promise<Embeddings> {
  // 1. Explicit MEMABLE_EMBEDDINGS=ollama
  if (provider === 'ollama') {
    if (!(await isOllamaAvailable())) {
      throw new Error('MEMABLE_EMBEDDINGS=ollama but Ollama is not running');
    }
    console.error('[memable] Using Ollama embeddings (forced via MEMABLE_EMBEDDINGS)');
    return createOllamaEmbeddings();
  }
  
  // 2. Explicit MEMABLE_EMBEDDINGS=openai
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required for OpenAI embeddings');
    }
    console.error('[memable] Using OpenAI embeddings (forced via MEMABLE_EMBEDDINGS)');
    return openaiEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  // 3. Explicit OPENAI_API_KEY in config = user wants OpenAI
  if (process.env.OPENAI_API_KEY) {
    console.error('[memable] Using OpenAI embeddings (OPENAI_API_KEY set)');
    return openaiEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
  }
  
  // 4. Auto-detect: try Ollama
  if (await isOllamaAvailable()) {
    if (await hasEmbeddingModel()) {
      console.error('[memable] Using Ollama embeddings (auto-detected)');
      return createOllamaEmbeddings();
    } else {
      console.error('[memable] Ollama found but nomic-embed-text not installed.');
      console.error('[memable] Run: ollama pull nomic-embed-text');
    }
  }
  
  // 5. Nothing available
  throw new Error(
    'No embedding provider available.\n' +
    'Options:\n' +
    '  1. Install Ollama and run: ollama pull nomic-embed-text\n' +
    '  2. Set OPENAI_API_KEY environment variable\n' +
    '  3. Use hosted mode with MEMABLE_API_KEY'
  );
}
```

### 3. Update CLI (`packages/memable/src/mcp/cli.ts`)

```typescript
async function runLocalMode() {
  const embeddings = await createEmbeddings(
    process.env.MEMABLE_EMBEDDINGS as EmbeddingProvider || 'auto'
  );
  
  // ... rest of local mode setup
}
```

## Environment Variables

| Variable | Values | Description |
|----------|--------|-------------|
| `MEMABLE_EMBEDDINGS` | `ollama`, `openai`, `auto` | Force embedding provider (default: auto) |
| `OLLAMA_HOST` | URL | Ollama server URL (default: http://localhost:11434) |
| `OPENAI_API_KEY` | string | OpenAI API key (required if using OpenAI) |

## Dimension Handling

**Important:** Ollama nomic-embed-text produces 768-dim vectors, OpenAI produces 1536-dim.

Options:
1. **Store dimension with vectors** - DB stores vector + dimension, query uses same provider
2. **Standardize on one dimension** - Pad/truncate (not recommended, loses info)
3. **Require consistent provider per namespace** - Don't mix providers in same space

**Recommendation:** Option 3 - store provider info with namespace, warn if switching.

## User Experience

**First run with Ollama:**
```
$ npx memable
[memable] Using Ollama embeddings (nomic-embed-text)
[memable] Local mode: ~/.memable/memories.db
[memable] MCP server ready
```

**First run without Ollama or OpenAI:**
```
$ npx memable
[memable] No embedding provider available.
Options:
  1. Install Ollama and run: ollama pull nomic-embed-text
  2. Set OPENAI_API_KEY environment variable
  3. Use hosted mode with MEMABLE_API_KEY
```

**Ollama running but model missing:**
```
$ npx memable
[memable] Ollama found but nomic-embed-text not installed.
[memable] Run: ollama pull nomic-embed-text
```

## Testing

1. Test with Ollama running + model installed → should use Ollama
2. Test with Ollama running + model missing → should show helpful message
3. Test with no Ollama + OPENAI_API_KEY → should use OpenAI
4. Test with no Ollama + no key → should show options
5. Test MEMABLE_EMBEDDINGS=ollama forces Ollama
6. Test MEMABLE_EMBEDDINGS=openai forces OpenAI

## Migration Path

Existing users with OpenAI embeddings can continue as-is. New local users get Ollama by default if available.

**Note:** Users shouldn't mix embedding providers in the same database, as the vector dimensions differ. Consider adding a metadata table to track which provider was used.

## Future: transformers.js

For true zero-config (no Ollama required), could bundle transformers.js with all-MiniLM-L6-v2. This would add ~50MB to package but require no external dependencies.

Lower priority - Ollama is common enough in the local-first community.
