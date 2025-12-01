import { openai } from "@llamaindex/openai";
import { mcp } from "@llamaindex/tools";
import { agent } from "@llamaindex/workflow";
import type { PromptMessage } from "@modelcontextprotocol/sdk/types.js";
import { createLoggedLLM, LLMLogger } from "./llm-logger";

const server = mcp({
  command: "node",
  args: ["D:\\LlamaIndexTS\\examples\\dist\\server.bundle.js"],
  verbose: true,
});

async function main() {
  const tools = await server.tools();

  // Получаем промпт с сервера
  const promptResult = await server.getPrompt("json_response_required");

  // Извлекаем текст промпта из сообщений
  const serverPrompt = promptResult.messages
    .map((msg: PromptMessage) => {
      if (msg.content.type === "text") {
        return msg.content.text;
      }
      return "";
    })
    .join("\n");

  // Дополнительные инструкции для агента
  const additionalInstructions = `
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

  const systemPrompt = `${additionalInstructions}\n\n${serverPrompt}`;

  // Создаем логгер для отслеживания токенов
  const logger = new LLMLogger("./logs");

  try {
    // Создаем LLM с логированием
    const baseLLM = openai({ model: "gpt-4.1-nano" });
    const loggedLLM = createLoggedLLM(baseLLM, logger);

    const myAgent = agent({
      name: "Assistant",
      systemPrompt,
      tools,
      llm: loggedLLM,
      verbose: true,
    });

    const response = await myAgent.run("Сколько рейсов всего было совершено?");

    console.log("RAW RESPONSE:", response);
    console.log("RESULT:", response.data.result);

    // Парсим JSON если ответ в строковом формате
    try {
      const jsonResult =
        typeof response.data.result === "string"
          ? JSON.parse(response.data.result)
          : response.data.result;
      console.log("JSON RESULT:", jsonResult);
    } catch (e) {
      console.log("Result is not JSON, showing as text:", response.data.result);
    }
  } finally {
    await server.cleanup();
  }
}

main().catch(console.error);
