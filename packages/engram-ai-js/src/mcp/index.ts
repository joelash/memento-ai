/**
 * MCP (Model Context Protocol) server for engram-ai.
 * 
 * Exposes memory operations as MCP tools that can be used by
 * Claude Desktop, Cursor, and other MCP-compatible AI tools.
 * 
 * @example
 * ```typescript
 * import { createMcpServer } from 'engram-ai/mcp';
 * import { createMemoryStore, openaiEmbeddings } from 'engram-ai';
 * import { neon } from '@neondatabase/serverless';
 * 
 * const store = createMemoryStore({
 *   sql: neon(process.env.DATABASE_URL!),
 *   embeddings: openaiEmbeddings(),
 * });
 * 
 * const server = createMcpServer({ store });
 * server.listen();
 * ```
 */

import type { MemoryStore } from '../store.js';
import { Durability, MemoryType } from '../schema.js';

/**
 * MCP Server configuration.
 */
export interface McpServerConfig {
  /** Memory store instance. */
  store: MemoryStore;
  /** Default namespace for memories (default: ['default']). */
  defaultNamespace?: string[];
  /** Server name (default: 'engram-ai'). */
  name?: string;
  /** Server version (default: '0.1.0'). */
  version?: string;
}

/**
 * MCP Tool definition.
 */
interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * MCP Server for engram-ai memories.
 * 
 * Implements the Model Context Protocol to expose memory operations
 * as tools for AI assistants.
 */
export class McpServer {
  private store: MemoryStore;
  private namespace: string[];
  private name: string;
  private version: string;

  constructor(config: McpServerConfig) {
    this.store = config.store;
    this.namespace = config.defaultNamespace ?? ['default'];
    this.name = config.name ?? 'engram-ai';
    this.version = config.version ?? '0.1.0';
  }

  /**
   * Get server info for MCP handshake.
   */
  getServerInfo() {
    return {
      name: this.name,
      version: this.version,
      capabilities: {
        tools: {},
      },
    };
  }

  /**
   * Get available tools.
   */
  getTools(): McpTool[] {
    return [
      {
        name: 'remember',
        description: 'Store a new memory. Use this to remember facts, rules, decisions, preferences, or context for later.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The memory content to store',
            },
            type: {
              type: 'string',
              enum: ['fact', 'rule', 'decision', 'preference', 'context', 'observation'],
              description: 'Semantic type of this memory',
            },
            durability: {
              type: 'string',
              enum: ['core', 'situational', 'episodic'],
              description: 'How permanent this memory is (core = permanent, situational = temporary, episodic = decays)',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for categorization',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'recall',
        description: 'Search memories by semantic similarity. Use this to find relevant context before responding.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'What to search for',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of memories to return (default: 5)',
            },
            type: {
              type: 'string',
              enum: ['fact', 'rule', 'decision', 'preference', 'context', 'observation'],
              description: 'Filter by memory type',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_memories',
        description: 'List all memories, optionally filtered by type or durability.',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['fact', 'rule', 'decision', 'preference', 'context', 'observation'],
              description: 'Filter by memory type',
            },
            durability: {
              type: 'string',
              enum: ['core', 'situational', 'episodic'],
              description: 'Filter by durability',
            },
          },
        },
      },
      {
        name: 'forget',
        description: 'Delete a specific memory by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Memory ID to delete',
            },
          },
          required: ['id'],
        },
      },
    ];
  }

  /**
   * Handle a tool call.
   */
  async handleToolCall(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
    try {
      let result: unknown;

      switch (name) {
        case 'remember':
          result = await this.handleRemember(args);
          break;
        case 'recall':
          result = await this.handleRecall(args);
          break;
        case 'list_memories':
          result = await this.handleListMemories(args);
          break;
        case 'forget':
          result = await this.handleForget(args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async handleRemember(args: Record<string, unknown>) {
    const text = args.text as string;
    const memoryType = args.type
      ? (args.type as string).toUpperCase() as keyof typeof MemoryType
      : undefined;
    const durability = args.durability
      ? (args.durability as string).toUpperCase() as keyof typeof Durability
      : undefined;
    const tags = args.tags as string[] | undefined;

    const memory = await this.store.add(this.namespace, {
      text,
      memoryType: memoryType ? MemoryType[memoryType] : undefined,
      durability: durability ? Durability[durability] : undefined,
      tags,
    });

    return {
      success: true,
      memory: {
        id: memory.id,
        text: memory.text,
        type: memory.memoryType,
        durability: memory.durability,
      },
    };
  }

  private async handleRecall(args: Record<string, unknown>) {
    const query = args.query as string;
    const limit = (args.limit as number) ?? 5;
    const memoryType = args.type
      ? (args.type as string).toUpperCase() as keyof typeof MemoryType
      : undefined;

    const memories = await this.store.search(this.namespace, {
      query,
      limit,
      memoryType: memoryType ? [MemoryType[memoryType]] : undefined,
    });

    return {
      count: memories.length,
      memories: memories.map((m) => ({
        id: m.id,
        text: m.text,
        type: m.memoryType,
        durability: m.durability,
        confidence: m.confidence,
      })),
    };
  }

  private async handleListMemories(args: Record<string, unknown>) {
    const memories = await this.store.listAll(this.namespace);

    // Filter in JS
    let filtered = memories;

    if (args.type) {
      const memoryType = (args.type as string).toUpperCase() as keyof typeof MemoryType;
      filtered = filtered.filter((m) => m.memoryType === MemoryType[memoryType]);
    }

    if (args.durability) {
      const durability = (args.durability as string).toUpperCase() as keyof typeof Durability;
      filtered = filtered.filter((m) => m.durability === Durability[durability]);
    }

    return {
      count: filtered.length,
      memories: filtered.map((m) => ({
        id: m.id,
        text: m.text,
        type: m.memoryType,
        durability: m.durability,
      })),
    };
  }

  private async handleForget(args: Record<string, unknown>) {
    const id = args.id as string;
    const deleted = await this.store.delete(this.namespace, id);

    return {
      success: deleted,
      message: deleted ? 'Memory deleted' : 'Memory not found',
    };
  }

  /**
   * Handle incoming MCP JSON-RPC message.
   */
  async handleMessage(message: {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params?: unknown;
  }): Promise<{
    jsonrpc: '2.0';
    id: string | number;
    result?: unknown;
    error?: { code: number; message: string };
  }> {
    const { id, method, params } = message;

    try {
      let result: unknown;

      switch (method) {
        case 'initialize':
          result = {
            protocolVersion: '2024-11-05',
            serverInfo: this.getServerInfo(),
            capabilities: { tools: {} },
          };
          break;

        case 'tools/list':
          result = { tools: this.getTools() };
          break;

        case 'tools/call':
          const { name, arguments: args } = params as {
            name: string;
            arguments: Record<string, unknown>;
          };
          result = await this.handleToolCall(name, args);
          break;

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          };
      }

      return { jsonrpc: '2.0', id, result };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

/**
 * Create an MCP server for engram-ai memories.
 */
export function createMcpServer(config: McpServerConfig): McpServer {
  return new McpServer(config);
}
