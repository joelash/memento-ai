/**
 * Memory store implementations for different database drivers.
 * 
 * Compatible with both pg and @neondatabase/serverless.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Durability,
  Memory,
  MemoryCreate,
  MemoryQuery,
  MemorySource,
  MemoryUpdate,
  Namespace,
  isMemoryCurrent,
  isMemoryValid,
} from './schema.js';

/**
 * Embeddings provider interface.
 */
export interface EmbeddingsProvider {
  /** Generate embeddings for the given texts. */
  embed(texts: string[]): Promise<number[][]>;
  /** Embedding dimensions. */
  dimensions: number;
}

/**
 * SQL executor interface - compatible with pg, @neondatabase/serverless, etc.
 */
export interface SqlExecutor {
  <T extends Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
}

/**
 * Configuration for MemoryStore.
 */
export interface MemoryStoreConfig {
  /** SQL executor (neon() or pg pool.query). */
  sql: SqlExecutor;
  /** Embeddings provider for semantic search. */
  embeddings: EmbeddingsProvider;
  /** Table name prefix (default: 'engram'). */
  tablePrefix?: string;
}

/**
 * Memory store with semantic search and version chains.
 * 
 * Compatible with Python engram-ai schema for cross-language use.
 * Works with both pg and Neon serverless drivers.
 */
export class MemoryStore {
  private sql: SqlExecutor;
  private embeddings: EmbeddingsProvider;
  private tablePrefix: string;
  private _tableName: string;

  constructor(config: MemoryStoreConfig) {
    this.sql = config.sql;
    this.embeddings = config.embeddings;
    this.tablePrefix = config.tablePrefix ?? 'engram';
    this._tableName = `${this.tablePrefix}_memories`;
  }

  private get tableName(): string {
    return this._tableName;
  }

  /**
   * Execute raw SQL with parameters (Neon-compatible).
   * Table name is interpolated as a string since it's static/trusted.
   */
  private async rawQuery<T extends Record<string, unknown>>(
    query: string,
    params: unknown[] = []
  ): Promise<T[]> {
    // Build a tagged template call from raw SQL
    // Split query by $1, $2, etc. placeholders
    const parts = query.split(/\$\d+/);
    const strings = Object.assign(parts, { raw: parts }) as TemplateStringsArray;
    return this.sql<T>(strings, ...params);
  }

  /**
   * Create tables and indexes. Call once at startup.
   */
  async setup(): Promise<void> {
    const table = this.tableName;
    const dims = this.embeddings.dimensions;
    
    // Create pgvector extension if not exists
    await this.rawQuery('CREATE EXTENSION IF NOT EXISTS vector');

    // Create memories table (using raw SQL for Neon compatibility)
    await this.rawQuery(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id UUID PRIMARY KEY,
        namespace TEXT[] NOT NULL,
        text TEXT NOT NULL,
        durability VARCHAR(20) NOT NULL DEFAULT 'episodic',
        memory_type VARCHAR(20),
        confidence REAL NOT NULL DEFAULT 0.8,
        source VARCHAR(20) NOT NULL DEFAULT 'inferred',
        valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        valid_until TIMESTAMPTZ,
        supersedes UUID,
        superseded_by UUID,
        superseded_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_accessed_at TIMESTAMPTZ,
        access_count INTEGER NOT NULL DEFAULT 0,
        tags TEXT[] NOT NULL DEFAULT '{}',
        metadata JSONB NOT NULL DEFAULT '{}',
        embedding vector(${dims})
      )
    `);

    // Create indexes
    await this.rawQuery(`
      CREATE INDEX IF NOT EXISTS idx_${table}_namespace
      ON ${table} USING GIN (namespace)
    `);

    await this.rawQuery(`
      CREATE INDEX IF NOT EXISTS idx_${table}_embedding
      ON ${table} 
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
  }

  /**
   * Add a new memory.
   */
  async add(namespace: Namespace, input: MemoryCreate): Promise<Memory> {
    const id = uuidv4();
    const now = new Date();

    const memory: Memory = {
      id,
      text: input.text,
      durability: input.durability ?? Durability.EPISODIC,
      memoryType: input.memoryType ?? null,
      confidence: input.confidence ?? 0.8,
      source: input.source ?? MemorySource.INFERRED,
      validFrom: input.validFrom ?? now,
      validUntil: input.validUntil ?? null,
      supersedes: null,
      supersededBy: null,
      supersededAt: null,
      createdAt: now,
      lastAccessedAt: null,
      accessCount: 0,
      tags: input.tags ?? [],
      metadata: input.metadata ?? {},
    };

    // Generate embedding
    const [embedding] = await this.embeddings.embed([memory.text]);

    await this.rawQuery(
      `INSERT INTO ${this.tableName} (
        id, namespace, text, durability, memory_type, confidence, source,
        valid_from, valid_until, supersedes, superseded_by, superseded_at,
        created_at, last_accessed_at, access_count, tags, metadata, embedding
      ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $11::uuid, $12, $13, $14, $15, $16, $17, $18::vector
      )`,
      [
        id,
        namespace,
        memory.text,
        memory.durability,
        memory.memoryType,
        memory.confidence,
        memory.source,
        memory.validFrom.toISOString(),
        memory.validUntil?.toISOString() ?? null,
        memory.supersedes,
        memory.supersededBy,
        memory.supersededAt?.toISOString() ?? null,
        memory.createdAt.toISOString(),
        memory.lastAccessedAt?.toISOString() ?? null,
        memory.accessCount,
        memory.tags,
        JSON.stringify(memory.metadata),
        JSON.stringify(embedding),
      ]
    );

    return memory;
  }

  /**
   * Get a memory by ID.
   */
  async get(namespace: Namespace, id: string): Promise<Memory | null> {
    const rows = await this.rawQuery<MemoryRow>(
      `SELECT * FROM ${this.tableName}
       WHERE id = $1::uuid AND namespace = $2
       LIMIT 1`,
      [id, namespace]
    );

    if (rows.length === 0) return null;
    return this.rowToMemory(rows[0]);
  }

  /**
   * Update a memory by creating a new version (version chain).
   */
  async update(
    namespace: Namespace,
    id: string,
    update: MemoryUpdate
  ): Promise<Memory> {
    const oldMemory = await this.get(namespace, id);
    if (!oldMemory) {
      throw new Error(`Memory ${id} not found`);
    }

    // Create new version
    const newMemory = await this.add(namespace, {
      text: update.text,
      durability: oldMemory.durability,
      confidence: update.confidence ?? 0.9,
      source: update.source ?? MemorySource.EXPLICIT,
      validFrom: update.validFrom,
      validUntil: update.validUntil,
      tags: oldMemory.tags,
      metadata: { ...oldMemory.metadata, previousVersion: oldMemory.id },
    });

    // Mark old memory as superseded
    const now = new Date();
    await this.rawQuery(
      `UPDATE ${this.tableName}
       SET superseded_by = $1::uuid, superseded_at = $2
       WHERE id = $3::uuid AND namespace = $4`,
      [newMemory.id, now.toISOString(), id, namespace]
    );

    // Update new memory with supersedes reference
    await this.rawQuery(
      `UPDATE ${this.tableName}
       SET supersedes = $1::uuid
       WHERE id = $2::uuid`,
      [id, newMemory.id]
    );

    return { ...newMemory, supersedes: id };
  }

  /**
   * Delete a memory.
   */
  async delete(namespace: Namespace, id: string): Promise<boolean> {
    const result = await this.rawQuery(
      `DELETE FROM ${this.tableName}
       WHERE id = $1::uuid AND namespace = $2`,
      [id, namespace]
    );
    return (result as any).count > 0;
  }

  /**
   * Semantic search for memories.
   */
  async search(namespace: Namespace, query: MemoryQuery): Promise<Memory[]> {
    // Generate query embedding
    const [queryEmbedding] = await this.embeddings.embed([query.query]);
    const limit = query.limit ?? 10;
    const checkTime = query.validAt ?? new Date();

    // Search with cosine similarity
    const rows = await this.rawQuery<MemoryRow & { similarity: number }>(
      `SELECT *, 
        1 - (embedding <=> $1::vector) as similarity
       FROM ${this.tableName}
       WHERE namespace = $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [JSON.stringify(queryEmbedding), namespace, limit * 2]
    );

    // Apply filters in JS (more flexible than SQL)
    const memories: Memory[] = [];
    for (const row of rows) {
      const memory = this.rowToMemory(row);

      if (!query.includeSuperseded && !isMemoryCurrent(memory)) {
        continue;
      }

      if (!query.includeExpired && !isMemoryValid(memory, checkTime)) {
        continue;
      }

      if (query.minConfidence && memory.confidence < query.minConfidence) {
        continue;
      }

      if (query.durability && !query.durability.includes(memory.durability)) {
        continue;
      }

      if (
        query.memoryType &&
        (!memory.memoryType || !query.memoryType.includes(memory.memoryType))
      ) {
        continue;
      }

      if (query.tags && !query.tags.some((t) => memory.tags.includes(t))) {
        continue;
      }

      memories.push(memory);

      if (memories.length >= limit) {
        break;
      }
    }

    return memories;
  }

  /**
   * List all memories in a namespace.
   */
  async listAll(
    namespace: Namespace,
    options?: { includeSuperseded?: boolean; includeExpired?: boolean }
  ): Promise<Memory[]> {
    const rows = await this.rawQuery<MemoryRow>(
      `SELECT * FROM ${this.tableName}
       WHERE namespace = $1
       ORDER BY created_at DESC`,
      [namespace]
    );

    const now = new Date();
    return rows
      .map((row) => this.rowToMemory(row))
      .filter((memory) => {
        if (!options?.includeSuperseded && !isMemoryCurrent(memory)) {
          return false;
        }
        if (!options?.includeExpired && !isMemoryValid(memory, now)) {
          return false;
        }
        return true;
      });
  }

  /**
   * Count memories in a namespace.
   */
  async count(namespace: Namespace): Promise<number> {
    const rows = await this.rawQuery<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${this.tableName}
       WHERE namespace = $1`,
      [namespace]
    );
    return parseInt(rows[0]?.count ?? '0', 10);
  }

  /**
   * Convert database row to Memory object.
   */
  private rowToMemory(row: MemoryRow): Memory {
    return {
      id: row.id,
      text: row.text,
      durability: row.durability as Durability,
      memoryType: row.memory_type as Memory['memoryType'],
      confidence: row.confidence,
      source: row.source as MemorySource,
      validFrom: new Date(row.valid_from),
      validUntil: row.valid_until ? new Date(row.valid_until) : null,
      supersedes: row.supersedes,
      supersededBy: row.superseded_by,
      supersededAt: row.superseded_at ? new Date(row.superseded_at) : null,
      createdAt: new Date(row.created_at),
      lastAccessedAt: row.last_accessed_at
        ? new Date(row.last_accessed_at)
        : null,
      accessCount: row.access_count,
      tags: row.tags,
      metadata: row.metadata,
    };
  }
}

/**
 * Database row type.
 */
interface MemoryRow extends Record<string, unknown> {
  id: string;
  namespace: string[];
  text: string;
  durability: string;
  memory_type: string | null;
  confidence: number;
  source: string;
  valid_from: string;
  valid_until: string | null;
  supersedes: string | null;
  superseded_by: string | null;
  superseded_at: string | null;
  created_at: string;
  last_accessed_at: string | null;
  access_count: number;
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * Create a memory store with Neon serverless driver.
 */
export function createMemoryStore(config: MemoryStoreConfig): MemoryStore {
  return new MemoryStore(config);
}
