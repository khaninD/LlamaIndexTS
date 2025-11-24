# LlamaIndex.TS Examples - AI Coding Agent Guide

## Project Overview

This is the **examples package** for LlamaIndex.TS - a comprehensive collection of TypeScript/JavaScript examples demonstrating LLM application patterns, RAG (Retrieval-Augmented Generation), agents, workflows, and integrations with 30+ vector stores and LLM providers.

**Key Architecture**: Modular provider system where core functionality lives in `llamaindex` and providers are separate packages (`@llamaindex/openai`, `@llamaindex/anthropic`, etc.). Examples show integration patterns, not library implementation.

## Running Examples

All examples are executable TypeScript files run with `tsx` (not compiled):

```bash
# Standard pattern for running any example
npx tsx ./rag/starter.ts
npx tsx ./agents/agent/single-agent.ts
npx tsx ./models/openai/openai.ts

# MCP server examples (special npm scripts)
npm run start:mcp        # SQLite MCP server
npm run start:mcp-pg     # PostgreSQL MCP server
npm run start:client     # MCP client example
```

**Never suggest** running `tsc` or `node` directly - always use `tsx` for TypeScript execution.

## Environment Setup

Most examples require API keys. Examples typically check `process.env.OPENAI_API_KEY` and similar. Set before running:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-..."
```

## Import Patterns (Critical)

LlamaIndex.TS uses **modular provider imports** - never import providers from `llamaindex`:

```typescript
// ✅ CORRECT - Modular imports
import { VectorStoreIndex, Document, Settings } from "llamaindex";
import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { claude } from "@llamaindex/anthropic";
import { gemini } from "@llamaindex/google";
import { PineconeVectorStore } from "@llamaindex/pinecone";

// ❌ WRONG - Don't import providers from llamaindex
import { OpenAI } from "llamaindex";
```

**Provider packages** follow pattern: `@llamaindex/<provider-name>` (openai, anthropic, google, pinecone, postgres, chromadb, etc.)

## Settings Configuration (Critical Pattern)

LlamaIndex uses **global Settings object** with AsyncLocalStorage for per-request configuration:

```typescript
import { Settings } from "llamaindex";
import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";

// Global configuration (simple examples)
Settings.llm = new OpenAI({ model: "gpt-4o" });
Settings.embedModel = new OpenAIEmbedding({ model: "text-embedding-3-small" });

// Per-request configuration (multi-tenant/API contexts) - use withLLM/withEmbedModel
Settings.withLLM(customLLM, async () => {
  return Settings.withEmbedModel(customEmbedding, async () => {
    // API-specific logic here - no race conditions
  });
});
```

**Never set Settings.llm/embedModel directly in API handlers** - causes race conditions. Use `.withLLM()` and `.withEmbedModel()` for request-scoped configuration.

## Example Structure Patterns

### Standard RAG Example Pattern

```typescript
import { Document, VectorStoreIndex } from "llamaindex";
import { OpenAI } from "@llamaindex/openai";

async function main() {
  // 1. Create documents
  const documents = [new Document({ text: "content...", id_: "doc1" })];

  // 2. Build index (automatically creates embeddings)
  const index = await VectorStoreIndex.fromDocuments(documents);

  // 3. Create query engine
  const queryEngine = index.asQueryEngine();

  // 4. Query
  const response = await queryEngine.query({ query: "question?" });
  console.log(response.toString());
}

main().catch(console.error);
```

### Agent Example Pattern (Modern @llamaindex/workflow)

```typescript
import { openai } from "@llamaindex/openai";
import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { z } from "zod";

// Define tools with Zod schemas
const weatherTool = tool({
  name: "get_weather",
  description: "Get weather for a location",
  parameters: z.object({
    location: z.string().describe("City name"),
  }),
  execute: ({ location }) => `${location} is sunny!`,
});

// Create agent
const myAgent = agent({
  llm: openai({ model: "gpt-4o" }),
  tools: [weatherTool],
  verbose: true,
});

// Run agent
const result = await myAgent.run("What's the weather in Paris?");
```

### Storage Context Pattern (Persistent Vector Store)

```typescript
import { storageContextFromDefaults, VectorStoreIndex } from "llamaindex";
import { PGVectorStore } from "@llamaindex/postgres";

// Create vector store
const vectorStore = new PGVectorStore({
  clientConfig: { connectionString: process.env.PG_CONNECTION_STRING },
});

// Build storage context
const storageContext = await storageContextFromDefaults({ vectorStore });

// Create index with storage
const index = await VectorStoreIndex.fromDocuments(docs, { storageContext });

// Or load existing index
const loadedIndex = await VectorStoreIndex.fromVectorStore(vectorStore);
```

## Directory Organization

- **`agents/`** - Agent implementations (prefer `agents/agent/` over `deprecated/agents/`)
  - `agents/agent/` - Modern agents using `@llamaindex/workflow`
  - `agents/workflow/` - Workflow orchestration patterns
  - `agents/memory/` - Custom memory implementations
- **`rag/`** - RAG patterns (indexing, querying, chat engines)
  - `rag/starter.ts` - Best starting point for basic RAG
  - `rag/chatEngine.ts` - Conversational RAG with memory
  - `rag/chat-engine/` - Various chat engine types
- **`models/`** - Provider-specific examples organized by provider (openai/, anthropic/, gemini/, ollama/, etc.)

- **`storage/`** - Vector store integrations (pinecone-vector-store/, pg/, chromadb/, qdrantdb/, weaviate/, mongodb/, etc.)

- **`multimodal/`** - Vision and multimodal examples (image analysis, CLIP embeddings)

- **`mcp/`** - Model Context Protocol server examples

- **`deprecated/`** - Legacy code (avoid using as reference)

## Key Development Patterns

### Tool Definition (Zod + FunctionTool)

```typescript
import { tool } from "llamaindex";
import { z } from "zod";

export const myTool = tool({
  name: "tool_name",
  description: "Clear description for LLM",
  parameters: z.object({
    param: z.string().describe("Parameter description"),
  }),
  execute: async ({ param }) => {
    // Tool logic
    return result;
  },
});
```

### Workflow Pattern (@llamaindex/workflow)

```typescript
import { createWorkflow, workflowEvent } from "@llamaindex/workflow";
import { openai } from "@llamaindex/openai";

// Define events
const startEvent = workflowEvent<string>();
const resultEvent = workflowEvent<{ result: string }>();

// Create workflow
const workflow = createWorkflow();

// Define handlers
workflow.handle([startEvent], async (context, event) => {
  const llm = openai({ model: "gpt-4o" });
  const response = await llm.complete({ prompt: event.data });
  return resultEvent.with({ result: response.text });
});

// Run workflow
const { stream, sendEvent } = workflow.createContext();
sendEvent(startEvent.with("input data"));
for await (const event of stream) {
  if (resultEvent.include(event)) {
    console.log(event.data.result);
  }
}
```

### Vector Store Collections (PostgreSQL, etc.)

```typescript
const pgvs = new PGVectorStore({ clientConfig });
pgvs.setCollection("collection_name"); // Namespace/tenant isolation
await pgvs.clearCollection(); // Clean before loading
```

## Build and Bundling

Examples package has webpack configuration for MCP servers:

```bash
pnpm build      # Webpack production build (dist/server.bundle.js)
pnpm build:dev  # Development build
pnpm start      # Run bundled server
```

Webpack externals: `pg`, `fs`, `path`, `crypto` (native modules kept external)

## Testing Patterns

This is an **examples package** - tests exist in parent directories (`unit/`, `packages/*/tests/`, `e2e/`). Examples are meant to be run directly for validation, not unit tested.

## Common Pitfalls

1. **Don't import providers from `llamaindex`** - use `@llamaindex/provider-name`
2. **Don't use Settings.llm in API routes directly** - use `Settings.withLLM(llm, () => {...})`
3. **Don't use deprecated agents** - use `@llamaindex/workflow` based agents
4. **Don't forget error handling** - check for missing API keys before running
5. **Don't use `node file.ts`** - always use `npx tsx file.ts`

## Key Files for Reference

- `agents/agent/single-agent.ts` - Basic agent pattern
- `agents/agent/query-tool.ts` - Agent + RAG integration
- `agents/workflow/joke.ts` - Complete workflow example
- `rag/starter.ts` - Basic RAG starting point
- `storage/storageContext.ts` - Persistent storage pattern
- `CLAUDE.md` - Detailed project documentation

## Provider-Specific Notes

**OpenAI**: Default provider, most examples use it. Models: gpt-4o, gpt-4o-mini, text-embedding-3-small

**Anthropic**: Use `claude()` function, supports streaming and prompt caching

**Google Gemini**: Use `gemini()`, special models for embeddings (GEMINI_EMBEDDING_MODEL)

**PostgreSQL/Supabase**: Most production-ready vector store, uses pgvector extension

**Pinecone/ChromaDB/Qdrant**: Cloud-native vector stores with examples in respective directories
