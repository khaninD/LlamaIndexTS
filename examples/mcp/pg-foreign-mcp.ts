import { openai } from "@llamaindex/openai";
import { mcp } from "@llamaindex/tools";
import { agent } from "@llamaindex/workflow";
import { createLoggedLLM, LLMLogger } from "./llm-logger";

const pgServer = mcp({
  command: "node",
  args: ["D:\\LlamaIndexTS\\examples\\dist\\out-ts-mcp-server.bundle.js"],
  env: {
    PG_HOST: "localhost",
    PG_PORT: "5432",
    PG_USER: "postgres",
    PG_PASSWORD: "postgres",
    PG_DATABASE: "demo",
  },
  verbose: true,
});

async function main() {
  // Получаем инструменты от PostgreSQL MCP сервера
  const pgTools = await pgServer.tools();

  console.log("📦 Available tools from PostgreSQL MCP server:");
  pgTools.forEach((tool) => {
    console.log(`  - ${tool.metadata.name}: ${tool.metadata.description}`);
  });

  // System prompt для SQL аналитика
  const systemPrompt = `Ты - SQL аналитик. Используй инструменты для выполнения запросов к базе данных PostgreSQL.
  Инструменты:
- list_schemas - показывает все доступные схемы
- list_tables - показывает таблицы в конкретной схеме (параметр schema)
- get_table_schema - структура таблицы
- execute_sql - выполнение SQL
Рекомендованная последовательность:
1. Если нужно узнать о таблицах - сначала вызови list_schemas
2. Затем list_tables для нужной схемы (или для каждой)
3. Изучи структуру через get_table_schema
4. Выполни запрос через execute_sql
  `;

  // Создаем логгер для отслеживания токенов
  const logger = new LLMLogger("./logs");

  try {
    // Создаем LLM с логированием
    const baseLLM = openai({ model: "gpt-4.1" });
    const loggedLLM = createLoggedLLM(baseLLM, logger);

    const myAgent = agent({
      name: "SQL Assistant",
      systemPrompt,
      tools: pgTools,
      llm: loggedLLM,
      verbose: true,
    });

    console.log("\n🤖 Starting agent with question...\n");

    // Опционально: сначала попросим изучить структуру БД
    console.log("📋 Step 1: Analyzing database structure...\n");
    const schemaAnalysis = await myAgent.run(
      `Какой самый дорогой билет, выведи всю полную информацию о нем.`,
    );
    console.log("Database structure analyzed:");
    console.log(schemaAnalysis.data.result);
    console.log("\n" + "=".repeat(60) + "\n");

    //  // Теперь задаём основной вопрос
    //  console.log("📋 Step 2: Executing main query...\n");
    //  const response = await myAgent.run(
    //    "Опиши структуру базы",
    //  );

    //  console.log("\n" + "=".repeat(60));
    //  console.log("📊 FINAL RESULT:");
    //  console.log("=".repeat(60));
    //  console.log(response.data.result);
    //  console.log("=".repeat(60) + "\n");

    // // Парсим JSON если ответ в строковом формате
    // try {
    //   const jsonResult =
    //     typeof response.data.result === "string"
    //       ? JSON.parse(response.data.result)
    //       : response.data.result;
    //   console.log("✅ Parsed JSON result:");
    //   console.log(JSON.stringify(jsonResult, null, 2));
    // } catch (e) {
    //   console.log("ℹ️  Result is not JSON, showing as text");
    // }
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await pgServer.cleanup();
  }
}

main().catch(console.error);
