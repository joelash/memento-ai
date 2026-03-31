/**
 * Embeddings providers for memable.
 */

import type { EmbeddingsProvider } from './store.js';
import { isOllamaAvailable, hasOllamaModel, ollamaEmbeddings } from './embeddings-ollama.js';

export { ollamaEmbeddings, isOllamaAvailable, hasOllamaModel } from './embeddings-ollama.js';

export type EmbeddingProviderType = 'openai' | 'ollama' | 'auto';

/**
 * Auto-detect and create the best available embeddings provider.
 * 
 * Priority:
 * 1. MEMABLE_EMBEDDINGS=ollama → force Ollama
 * 2. MEMABLE_EMBEDDINGS=openai → force OpenAI
 * 3. OPENAI_API_KEY set → use OpenAI (explicit user intent)
 * 4. Auto-detect Ollama → use if available with model
 * 5. Error with helpful message
 */
export async function createEmbeddings(
  provider: EmbeddingProviderType = 'auto'
): Promise<EmbeddingsProvider> {
  // 1. Explicit MEMABLE_EMBEDDINGS=ollama
  if (provider === 'ollama') {
    if (!(await isOllamaAvailable())) {
      throw new Error(
        'MEMABLE_EMBEDDINGS=ollama but Ollama is not running.\n' +
        'Start Ollama or remove MEMABLE_EMBEDDINGS to auto-detect.'
      );
    }
    if (!(await hasOllamaModel())) {
      throw new Error(
        'MEMABLE_EMBEDDINGS=ollama but nomic-embed-text model not found.\n' +
        'Run: ollama pull nomic-embed-text'
      );
    }
    console.error('[memable] Using Ollama embeddings (forced via MEMABLE_EMBEDDINGS)');
    return ollamaEmbeddings();
  }

  // 2. Explicit MEMABLE_EMBEDDINGS=openai
  if (provider === 'openai') {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY required when MEMABLE_EMBEDDINGS=openai');
    }
    console.error('[memable] Using OpenAI embeddings (forced via MEMABLE_EMBEDDINGS)');
    return openaiEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
  }

  // 3. Explicit OPENAI_API_KEY = user wants OpenAI
  if (process.env.OPENAI_API_KEY) {
    console.error('[memable] Using OpenAI embeddings (OPENAI_API_KEY set)');
    return openaiEmbeddings({ apiKey: process.env.OPENAI_API_KEY });
  }

  // 4. Auto-detect: try Ollama
  if (await isOllamaAvailable()) {
    if (await hasOllamaModel()) {
      console.error('[memable] Using Ollama embeddings (auto-detected)');
      return ollamaEmbeddings();
    } else {
      console.error('[memable] Ollama found but nomic-embed-text not installed.');
      console.error('[memable] Run: ollama pull nomic-embed-text');
      // Fall through to error
    }
  }

  // 5. Nothing available
  throw new Error(
    'No embedding provider available.\n\n' +
    'Options:\n' +
    '  1. Install Ollama and run: ollama pull nomic-embed-text\n' +
    '  2. Set OPENAI_API_KEY environment variable\n' +
    '  3. Use hosted mode with MEMABLE_API_KEY'
  );
}

/**
 * OpenAI embeddings configuration.
 */
export interface OpenAIEmbeddingsConfig {
  /** OpenAI API key (defaults to OPENAI_API_KEY env var). */
  apiKey?: string;
  /** Model name (default: text-embedding-3-small). */
  model?: string;
  /** Embedding dimensions (default: 1536). */
  dimensions?: number;
  /** Base URL for API (e.g., for Helicone or other proxies). */
  baseUrl?: string;
  /** Additional headers (e.g., for Helicone auth). */
  headers?: Record<string, string>;
}

/**
 * OpenAI embeddings provider.
 */
export function openaiEmbeddings(config: OpenAIEmbeddingsConfig = {}): EmbeddingsProvider {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key required. Pass apiKey or set OPENAI_API_KEY.');
  }

  const model = config.model ?? 'text-embedding-3-small';
  const dimensions = config.dimensions ?? 1536;
  const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';

  return {
    dimensions,

    async embed(texts: string[]): Promise<number[][]> {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...config.headers,
        },
        body: JSON.stringify({
          model,
          input: texts,
          dimensions,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI embeddings failed: ${response.status} ${error}`);
      }

      const data = (await response.json()) as {
        data: Array<{ embedding: number[] }>;
      };
      return data.data.map((item) => item.embedding);
    },
  };
}

/**
 * Helicone-proxied OpenAI embeddings.
 */
export function heliconeEmbeddings(config: {
  heliconeKey: string;
  openaiKey?: string;
  model?: string;
  dimensions?: number;
}): EmbeddingsProvider {
  return openaiEmbeddings({
    apiKey: config.openaiKey,
    model: config.model,
    dimensions: config.dimensions,
    baseUrl: 'https://oai.helicone.ai/v1',
    headers: {
      'Helicone-Auth': `Bearer ${config.heliconeKey}`,
    },
  });
}

/**
 * Mock embeddings for testing (random vectors).
 */
export function mockEmbeddings(dimensions = 1536): EmbeddingsProvider {
  return {
    dimensions,
    async embed(texts: string[]): Promise<number[][]> {
      return texts.map(() => {
        const vec = Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
        // Normalize
        const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
        return vec.map((v) => v / norm);
      });
    },
  };
}
