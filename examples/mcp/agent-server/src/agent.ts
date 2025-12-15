import { openai } from "@llamaindex/openai";
import { mcp } from "@llamaindex/tools";
import { agent } from "@llamaindex/workflow";

// Path to MCP server - can be configured via env variable
const MCP_SERVER_PATH =
  process.env.MCP_SERVER_PATH ||
  "D:\\LlamaIndexTS\\examples\\dist\\server.bundle.js";

export async function createAgent(
  customSystemPrompt?: string,
  apiKey?: string,
) {
  // Create MCP server
  const server = mcp({
    command: "node",
    args: [MCP_SERVER_PATH],
    verbose: false,
  });

  try {
    const tools = await server.tools();

    // Default agent instructions
    const defaultInstructions = `
Ты - SQL аналитик. Используй инструменты для выполнения запросов к базе данных.

Инструменты которые у тебя есть:
- execute_sql - для выполнения SQL SELECT запросов
- get_table_schema - для получения структуры таблицы
- list_tables - для получения списка таблиц

ВАЖНЫЕ ИНСТРУКЦИИ:
1. Сначала используй list_tables чтобы узнать какие таблицы есть в базе
2. Затем используй get_table_schema чтобы изучить структуру таблиц
3. Только после этого формируй SQL запрос и используй execute_sql
4. Не пытайся отвечать без использования инструментов
`;

    const finalSystemPrompt = `${defaultInstructions}\n\n${customSystemPrompt || ""}`;

    // Create LLM with API key
    const llm = openai({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });

    // Create agent
    const sqlAgent = agent({
      name: "SQL Assistant",
      systemPrompt: finalSystemPrompt,
      tools,
      llm,
      verbose: process.env.VERBOSE === "true",
    });

    return { agent: sqlAgent, server };
  } catch (error) {
    await server.cleanup();
    throw error;
  }
}

export async function runAgent(
  query: string,
  systemPrompt?: string,
  apiKey?: string,
) {
  const { agent: sqlAgent, server } = await createAgent(systemPrompt, apiKey);

  try {
    // Run the agent
    const response = await sqlAgent.run(query);

    // Cleanup
    await server.cleanup();

    // Get result
    const result = response.data.result;

    // Try to parse JSON if result is string
    try {
      if (typeof result === "string") {
        const jsonResult = JSON.parse(result);
        return jsonResult;
      }
    } catch (e) {
      // Result is not JSON, return as is
    }

    return result;
  } catch (error) {
    await server.cleanup();
    throw error;
  }
}
