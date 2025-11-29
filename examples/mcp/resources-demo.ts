import { openai } from "@llamaindex/openai";
import { mcp } from "@llamaindex/tools";
import { agent } from "@llamaindex/workflow";
import type { PromptMessage } from "@modelcontextprotocol/sdk/types.js";

const server = mcp({
  command: "node",
  args: ["C:\\Users\\Daniil\\LlamaIndexTS\\examples\\dist\\server.bundle.js"],
  verbose: true,
});

async function main() {
  try {
    console.log("=== Демонстрация MCP Resources ===\n");

    // 1. Получаем список доступных ресурсов
    console.log("1. Получение списка ресурсов с сервера:");
    const resources = await server.resources();
    console.log(`Найдено ресурсов: ${resources.length}\n`);

    resources.forEach((resource) => {
      console.log(`  📦 ${resource.name}`);
      console.log(`     URI: ${resource.uri}`);
      console.log(`     Описание: ${resource.description || "Нет описания"}`);
      console.log(`     MIME Type: ${resource.mimeType || "Не указан"}\n`);
    });

    // 2. Читаем содержимое ресурса "database_schema"
    console.log("2. Чтение ресурса 'database_schema':");
    const schemaResource = await server.readResource("postgres://schema/all");

    if (schemaResource.contents && schemaResource.contents.length > 0) {
      const content = schemaResource.contents[0];
      if ("text" in content && content.text) {
        const schema = JSON.parse(content.text);
        console.log(
          `   База данных: ${schema.database}, Схема: ${schema.schema}`,
        );
        console.log(`   Всего таблиц: ${schema.total_tables}`);
        console.log(`   Таблицы: ${Object.keys(schema.tables).join(", ")}\n`);
      }
    }

    // 3. Читаем ресурс "tables_list"
    console.log("3. Чтение ресурса 'tables_list':");
    const tablesResource = await server.readResource("postgres://tables/list");

    if (tablesResource.contents && tablesResource.contents.length > 0) {
      const content = tablesResource.contents[0];
      if ("text" in content && content.text) {
        const data = JSON.parse(content.text);
        console.log(`   Схема: ${data.schema}`);
        console.log(`   Количество таблиц: ${data.count}`);
        console.log(`   Список: ${data.tables.join(", ")}\n`);
      }
    }

    // 4. Использование ресурсов в агенте
    console.log("4. Использование ресурсов в LLM агенте:\n");

    // Получаем промпт и инструменты
    const promptResult = await server.getPrompt("json_response_required");
    const tools = await server.tools();

    // Читаем схему базы данных как контекст
    const dbSchemaResource = await server.readResource("postgres://schema/all");
    let dbSchemaContext = "";

    if (dbSchemaResource.contents && dbSchemaResource.contents.length > 0) {
      const content = dbSchemaResource.contents[0];
      if ("text" in content && content.text) {
        dbSchemaContext = content.text;
      }
    }

    // Извлекаем текст промпта
    const serverPrompt = promptResult.messages
      .map((msg: PromptMessage) => {
        if (msg.content.type === "text") {
          return msg.content.text;
        }
        return "";
      })
      .join("\n");

    // Создаём системный промпт с контекстом из ресурса
    const systemPrompt = `Ты - SQL аналитик с доступом к базе данных PostgreSQL.

ДОСТУПНАЯ СХЕМА БАЗЫ ДАННЫХ:
${dbSchemaContext}

Используй эту информацию о структуре базы данных для формирования SQL запросов.

ИНСТРУМЕНТЫ:
- execute_sql - для выполнения SQL SELECT запросов
- get_table_schema - для получения структуры таблицы (если нужно уточнить детали)
- list_tables - для получения списка таблиц (информация уже есть выше)

ВАЖНЫЕ ИНСТРУКЦИИ:
1. Ты уже знаешь структуру всех таблиц из контекста выше
2. Используй эту информацию для формирования правильных SQL запросов
3. Не обязательно вызывать list_tables или get_table_schema, если информация уже есть
4. Формируй запросы напрямую, основываясь на схеме базы данных

${serverPrompt}`;

    const myAgent = agent({
      name: "SQL Assistant",
      systemPrompt,
      tools,
      llm: openai({ model: "gpt-4o-mini" }),
      verbose: true,
    });

    console.log("Запрос к агенту: 'Какие таблицы есть в базе данных?'\n");
    const response = await myAgent.run("Какие таблицы есть в базе данных?");

    console.log("\n=== Результат от агента ===");
    console.log("RAW RESPONSE:", response);
    console.log("RESULT:", response.data.result);

    // Парсим JSON если ответ в строковом формате
    try {
      const jsonResult =
        typeof response.data.result === "string"
          ? JSON.parse(response.data.result)
          : response.data.result;
      console.log("\nJSON RESULT:", JSON.stringify(jsonResult, null, 2));
    } catch (e) {
      console.log("Result is not JSON, showing as text:", response.data.result);
    }
  } finally {
    await server.cleanup();
  }
}

main().catch(console.error);
