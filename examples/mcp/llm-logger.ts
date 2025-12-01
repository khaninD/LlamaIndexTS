import type {
  ChatMessage,
  ChatResponse,
  ChatResponseChunk,
  LLMChatParamsNonStreaming,
  LLMChatParamsStreaming,
  ToolCallLLM,
} from "@llamaindex/core/llms";
import fs from "fs";
import path from "path";

interface ToolInfo {
  name: string;
  description?: string;
  parameters?: unknown;
}

interface ToolCall {
  name: string;
  input: unknown;
  id?: string;
}

interface TokenEstimate {
  input: number;
  output: number;
  total: number;
}

interface LogEntry {
  timestamp: string;
  type: "request" | "response" | "stream_chunk";
  model?: string;
  messages?: ChatMessage[];
  tools?: ToolInfo[];
  response?: string;
  toolCalls?: ToolCall[];
  tokensEstimate?: TokenEstimate;
  raw?: unknown;
}

export class LLMLogger {
  private logFile: string;
  private logs: LogEntry[] = [];

  constructor(logDir: string = "./logs") {
    // Создаем директорию для логов, если её нет
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Создаем файл с timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = path.join(logDir, `llm-log-${timestamp}.json`);
  }

  private estimateTokens(text: string): number {
    // Грубая оценка: ~4 символа = 1 токен для английского
    // Для русского текста коэффициент хуже
    return Math.ceil(text.length / 3);
  }

  private calculateMessageTokens(messages: ChatMessage[]): number {
    return messages.reduce((sum, msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      return sum + this.estimateTokens(content);
    }, 0);
  }

  logRequest(
    messages: ChatMessage[],
    tools?: Array<{ metadata?: Partial<ToolInfo>; name?: string }>,
    model?: string,
  ) {
    const inputTokens = this.calculateMessageTokens(messages);
    const toolsTokens = tools
      ? this.estimateTokens(JSON.stringify(tools.map((t) => t.metadata)))
      : 0;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: "request",
      model,
      messages,
      tools: tools?.map((t) => ({
        name: (t.metadata?.name || t.name) ?? "unknown",
        description: t.metadata?.description,
        parameters: t.metadata?.parameters,
      })),
      tokensEstimate: {
        input: inputTokens + toolsTokens,
        output: 0,
        total: inputTokens + toolsTokens,
      },
    };

    this.logs.push(entry);
    this.writeLog();

    console.log("\n=== LLM REQUEST ===");
    console.log(`Model: ${model || "default"}`);
    console.log(`Messages count: ${messages.length}`);
    console.log(
      `Estimated input tokens: ${entry.tokensEstimate?.input.toLocaleString() || 0}`,
    );
    if (tools && tools.length > 0) {
      const toolNames = tools
        .map((t) => (t.metadata?.name || t.name) ?? "unknown")
        .join(", ");
      console.log(`Tools: ${toolNames}`);
    }

    // Выводим последние сообщения
    const lastMessages = messages.slice(-3);
    console.log("\nLast messages:");
    lastMessages.forEach((msg, i) => {
      const content =
        typeof msg.content === "string"
          ? msg.content.substring(0, 200)
          : JSON.stringify(msg.content).substring(0, 200);
      console.log(
        `  [${msg.role}]: ${content}${content.length === 200 ? "..." : ""}`,
      );
    });
    console.log("===================\n");
  }

  logResponse(response: ChatResponse | string, raw?: unknown) {
    const responseText =
      typeof response === "string" ? response : response.message.content;
    const outputTokens = this.estimateTokens(
      typeof responseText === "string"
        ? responseText
        : JSON.stringify(responseText),
    );

    // Безопасное извлечение toolCall с проверкой типов
    let toolCalls: ToolCall[] | undefined = undefined;
    if (typeof response === "object" && response.message.options) {
      const options = response.message.options as Record<string, unknown>;
      if ("toolCall" in options && Array.isArray(options.toolCall)) {
        toolCalls = options.toolCall;
      }
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      type: "response",
      response: typeof responseText === "string" ? responseText : undefined,
      toolCalls,
      tokensEstimate: {
        input: 0,
        output: outputTokens,
        total: outputTokens,
      },
      raw,
    };

    this.logs.push(entry);
    this.writeLog();

    console.log("\n=== LLM RESPONSE ===");
    console.log(
      `Estimated output tokens: ${entry.tokensEstimate?.output.toLocaleString() || 0}`,
    );
    if (toolCalls) {
      console.log(`Tool calls: ${toolCalls.map((t) => t.name).join(", ")}`);
      toolCalls.forEach((call) => {
        console.log(
          `  - ${call.name}: ${JSON.stringify(call.input).substring(0, 100)}`,
        );
      });
    }
    if (typeof responseText === "string") {
      console.log(
        `Response: ${responseText.substring(0, 300)}${responseText.length > 300 ? "..." : ""}`,
      );
    }
    console.log("====================\n");

    // Выводим общую статистику
    this.printSummary();
  }

  private writeLog() {
    fs.writeFileSync(this.logFile, JSON.stringify(this.logs, null, 2));
  }

  printSummary() {
    const totalInputTokens = this.logs
      .filter((l) => l.type === "request")
      .reduce((sum, l) => sum + (l.tokensEstimate?.input || 0), 0);

    const totalOutputTokens = this.logs
      .filter((l) => l.type === "response")
      .reduce((sum, l) => sum + (l.tokensEstimate?.output || 0), 0);

    const totalTokens = totalInputTokens + totalOutputTokens;

    console.log("\n=== TOKEN USAGE SUMMARY ===");
    console.log(
      `Total requests: ${this.logs.filter((l) => l.type === "request").length}`,
    );
    console.log(`Estimated input tokens: ${totalInputTokens.toLocaleString()}`);
    console.log(
      `Estimated output tokens: ${totalOutputTokens.toLocaleString()}`,
    );
    console.log(`Estimated total tokens: ${totalTokens.toLocaleString()}`);
    console.log(`Log file: ${this.logFile}`);
    console.log("===========================\n");
  }
}

/**
 * Создает обертку для LLM с логированием
 */
export function createLoggedLLM(
  llm: ToolCallLLM,
  logger: LLMLogger,
): ToolCallLLM {
  const originalChat = llm.chat.bind(llm);

  // Переопределяем метод chat
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (llm as any).chat = async (
    params: LLMChatParamsStreaming | LLMChatParamsNonStreaming,
  ): Promise<any> => {
    // Логируем запрос
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger.logRequest(params.messages, params.tools, (llm as any).model);

    // Вызываем оригинальный метод
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await originalChat(params as any);

    // Если это stream, нужно обработать по-другому
    if (params.stream) {
      return (async function* () {
        let fullResponse = "";
        let lastChunk: ChatResponseChunk | undefined;

        for await (const chunk of result as AsyncIterable<ChatResponseChunk>) {
          fullResponse += chunk.delta;
          lastChunk = chunk;
          yield chunk;
        }

        // Логируем финальный ответ после завершения stream
        if (lastChunk) {
          logger.logResponse(fullResponse, lastChunk.raw);
        }
      })();
    } else {
      // Для non-streaming логируем сразу
      const response = result as unknown as ChatResponse;
      logger.logResponse(response, response.raw);
      return response;
    }
  };

  return llm;
}
