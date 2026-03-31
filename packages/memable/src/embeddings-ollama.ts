/**
 * Ollama embeddings provider for local-first mode.
 */

import type { EmbeddingsProvider } from './store.js';

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'nomic-embed-text';
const NOMIC_DIMENSIONS = 768;

/**
 * Check if Ollama is running and accessible.
 */
export async function isOllamaAvailable(host = DEFAULT_OLLAMA_HOST): Promise<boolean> {
  try {
    const res = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Check if a specific embedding model is installed in Ollama.
 */
export async function hasOllamaModel(
  model = DEFAULT_MODEL,
  host = DEFAULT_OLLAMA_HOST
): Promise<boolean> {
  try {
    const res = await fetch(`${host}/api/tags`);
    if (!res.ok) return false;
    
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return data.models?.some((m) => m.name.startsWith(model)) ?? false;
  } catch {
    return false;
  }
}

/**
 * Ollama embeddings configuration.
 */
export interface OllamaEmbeddingsConfig {
  /** Ollama server URL (defaults to http://localhost:11434). */
  host?: string;
  /** Model name (default: nomic-embed-text). */
  model?: string;
}

/**
 * Ollama embeddings provider.
 * 
 * Uses nomic-embed-text by default (768 dimensions).
 * 
 * @example
 * ```typescript
 * // First, ensure the model is installed:
 * // $ ollama pull nomic-embed-text
 * 
 * const embeddings = ollamaEmbeddings();
 * ```
 */
export function ollamaEmbeddings(config: OllamaEmbeddingsConfig = {}): EmbeddingsProvider {
  const host = config.host ?? process.env.OLLAMA_HOST ?? DEFAULT_OLLAMA_HOST;
  const model = config.model ?? DEFAULT_MODEL;
  
  // nomic-embed-text = 768, adjust if using different model
  const dimensions = model.startsWith('nomic-embed-text') ? NOMIC_DIMENSIONS : 768;

  return {
    dimensions,

    async embed(texts: string[]): Promise<number[][]> {
      // Ollama doesn't have native batch, so parallelize
      const results = await Promise.all(
        texts.map(async (text) => {
          const res = await fetch(`${host}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: text }),
          });

          if (!res.ok) {
            const error = await res.text();
            throw new Error(`Ollama embedding failed: ${res.status} ${error}`);
          }

          const data = (await res.json()) as { embedding: number[] };
          return data.embedding;
        })
      );
      
      return results;
    },
  };
}
