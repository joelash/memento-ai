"use client";

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";
import { CodeTabs } from "@/components/ui/code-tabs";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { motion } from "framer-motion";
import {
  Brain,
  GitBranch,
  Globe,
  Layers,
  MessageSquare,
  Sparkles,
  Zap,
  Code2,
  Server,
} from "lucide-react";
import Image from "next/image";

const pythonCode = `<span class="token-keyword">from</span> engram_ai <span class="token-keyword">import</span> build_store, MemoryCreate

<span class="token-keyword">with</span> <span class="token-function">build_store</span>(<span class="token-string">"postgresql://..."</span>) <span class="token-keyword">as</span> store:
    <span class="token-comment"># Remember something</span>
    store.<span class="token-function">add</span>(namespace, <span class="token-function">MemoryCreate</span>(
        text=<span class="token-string">"User prefers dark mode"</span>,
        durability=<span class="token-string">"core"</span>,  <span class="token-comment"># Never forget</span>
    ))

    <span class="token-comment"># Recall it later</span>
    memories = store.<span class="token-function">search</span>(namespace, <span class="token-string">"user preferences"</span>)`;

const typescriptCode = `<span class="token-keyword">import</span> { MemoryStore, createOpenAIEmbeddings } <span class="token-keyword">from</span> <span class="token-string">'engram-ai-js'</span>;
<span class="token-keyword">import</span> { neon } <span class="token-keyword">from</span> <span class="token-string">'@neondatabase/serverless'</span>;

<span class="token-keyword">const</span> store = <span class="token-keyword">new</span> <span class="token-function">MemoryStore</span>(<span class="token-function">neon</span>(DATABASE_URL), embeddings);

<span class="token-comment">// Remember something</span>
<span class="token-keyword">await</span> store.<span class="token-function">add</span>(namespace, {
  text: <span class="token-string">"User prefers dark mode"</span>,
  durability: <span class="token-string">"core"</span>,
});

<span class="token-comment">// Recall it later</span>
<span class="token-keyword">const</span> memories = <span class="token-keyword">await</span> store.<span class="token-function">search</span>(namespace, <span class="token-string">"user preferences"</span>);`;

const mcpCode = `<span class="token-comment">// MCP Server for Claude Desktop, Cursor, etc.</span>
{
  <span class="token-string">"mcpServers"</span>: {
    <span class="token-string">"engram"</span>: {
      <span class="token-string">"command"</span>: <span class="token-string">"npx"</span>,
      <span class="token-string">"args"</span>: [<span class="token-string">"engram-ai-mcp"</span>],
      <span class="token-string">"env"</span>: {
        <span class="token-string">"DATABASE_URL"</span>: <span class="token-string">"postgresql://..."</span>,
        <span class="token-string">"OPENAI_API_KEY"</span>: <span class="token-string">"sk-..."</span>
      }
    }
  }
}

<span class="token-comment">// Tools: remember, recall, list_memories, forget</span>`;

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="engram-ai" width={32} height={32} className="rounded-md" />
            <span className="font-semibold text-lg">
              engram<span className="text-purple-400">-ai</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/joelash/engram-ai" className="text-zinc-400 hover:text-white transition-colors text-sm">
              GitHub
            </a>
            <a href="https://github.com/joelash/engram-ai#quick-start" className="text-zinc-400 hover:text-white transition-colors text-sm">
              Docs
            </a>
            <a
              href="https://calendar.notion.so/meet/joelfriedman/ai-memory-consult"
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Book a Call
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 text-sm text-zinc-400 mb-8">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Now with TypeScript + MCP support</span>
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
          >
            Your AI agents keep{" "}
            <AnimatedGradientText>forgetting</AnimatedGradientText>.
            <br />
            Let&apos;s fix that.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto"
          >
            Production-grade semantic memory for AI agents. Works with Python, TypeScript, and any tool via MCP.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <ShimmerButton href="https://github.com/joelash/engram-ai">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              Get Started
            </ShimmerButton>
            <a
              href="https://calendar.notion.so/meet/joelfriedman/ai-memory-consult"
              className="px-6 py-3 rounded-lg border border-zinc-700 text-white hover:bg-zinc-800 transition-colors font-medium"
            >
              Book a Setup Call
            </a>
          </motion.div>
        </div>
      </section>

      {/* Code Examples */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Works everywhere</h2>
            <p className="text-zinc-400">Python, TypeScript, or any tool via MCP</p>
          </div>

          <CodeTabs
            tabs={[
              {
                label: "Python",
                icon: <Code2 className="w-4 h-4" />,
                code: pythonCode,
              },
              {
                label: "TypeScript",
                icon: <Server className="w-4 h-4" />,
                code: typescriptCode,
              },
              {
                label: "MCP",
                icon: <MessageSquare className="w-4 h-4" />,
                code: mcpCode,
              },
            ]}
          />

          {/* Platform badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-10">
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
              <Globe className="w-4 h-4" />
              Cloudflare Workers
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
              <Zap className="w-4 h-4" />
              Neon Serverless
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-400">
              <Layers className="w-4 h-4" />
              Vercel AI SDK
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built for production</h2>
            <p className="text-zinc-400">Not another demo. Actually works.</p>
          </div>

          <BentoGrid>
            <BentoCard
              icon={<GitBranch className="w-6 h-6" />}
              title="Version Chains"
              description="When facts change, we create an audit trail. Debug why your agent thinks what it thinks."
              className="lg:col-span-2"
            />
            <BentoCard
              icon={<Layers className="w-6 h-6" />}
              title="Durability Tiers"
              description="Core facts (forever), situational context (temporary), episodic memories (decay over time)."
            />
            <BentoCard
              icon={<Globe className="w-6 h-6" />}
              title="Multi-Backend"
              description="Postgres for production, SQLite for dev, DuckDB for analytics. No vendor lock-in."
            />
            <BentoCard
              icon={<Brain className="w-6 h-6" />}
              title="Memory Types"
              description="Facts, rules, decisions, preferences, observations. Structured semantics for smart retrieval."
            />
            <BentoCard
              icon={<Zap className="w-6 h-6" />}
              title="Edge-Ready"
              description="TypeScript client works with Neon serverless on Cloudflare Workers. Sub-100ms latency."
            />
          </BentoGrid>
        </div>
      </section>

      {/* MCP Section */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/30 bg-purple-500/10 text-sm text-purple-400 mb-8">
            <MessageSquare className="w-4 h-4" />
            MCP Server Included
          </div>
          <h2 className="text-3xl font-bold mb-4">Memory for any tool</h2>
          <p className="text-zinc-400 mb-10 max-w-2xl mx-auto">
            The included MCP server lets Claude Desktop, Cursor, and other tools remember things across sessions. No code changes needed.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {["remember", "recall", "list_memories", "forget"].map((tool) => (
              <div
                key={tool}
                className="px-4 py-3 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-sm text-purple-400"
              >
                {tool}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 border-t border-zinc-800">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Need help implementing?</h2>
          <p className="text-zinc-400 mb-10">
            I&apos;ll add production-grade memory to your AI agent in 1-2 weeks.
          </p>

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-8">
            <div className="flex flex-wrap justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">$500</div>
                <div className="text-sm text-zinc-400">Consult (2 hours)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">$3-5k</div>
                <div className="text-sm text-zinc-400">Full implementation</div>
              </div>
            </div>
            <a
              href="https://calendar.notion.so/meet/joelfriedman/ai-memory-consult"
              className="inline-flex items-center justify-center w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Book a Call →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto text-center text-sm text-zinc-500">
          Built by{" "}
          <a href="https://twitter.com/joelash" className="text-zinc-400 hover:text-white">
            @joelash
          </a>{" "}
          ·{" "}
          <a href="https://github.com/joelash/engram-ai" className="text-zinc-400 hover:text-white">
            GitHub
          </a>{" "}
          · MIT License
        </div>
      </footer>
    </div>
  );
}
