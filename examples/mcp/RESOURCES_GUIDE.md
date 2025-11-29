# MCP Resources - Полное руководство

## 🎯 Что такое MCP Resources?

**Resources** в Model Context Protocol (MCP) — это механизм для предоставления статического или динамического контекста LLM-моделям. В отличие от Tools (которые выполняют действия), Resources предоставляют данные для чтения.

## 🔍 Resources vs Tools vs Prompts

| Компонент     | Назначение               | Кто инициирует     | Пример                          |
| ------------- | ------------------------ | ------------------ | ------------------------------- |
| **Tools**     | Выполнение действий      | LLM вызывает       | `execute_sql()`, `search_web()` |
| **Prompts**   | Шаблоны инструкций       | Клиент запрашивает | `json_response_required`        |
| **Resources** | Предоставление контекста | LLM читает         | Схема БД, документация, файлы   |

## 📋 Когда использовать Resources?

### ✅ Хорошие примеры использования:

1. **Схемы баз данных** - структура таблиц и колонок
2. **Документация** - README, API docs, руководства
3. **Конфигурационные файлы** - package.json, tsconfig.json
4. **Логи приложения** - последние логи для анализа
5. **Исходный код** - файлы проекта для review
6. **Метаданные** - информация о доступных операциях

### ❌ Плохие примеры (используйте Tools):

1. **Выполнение SQL запросов** - это действие, используйте Tool
2. **Создание файлов** - это действие, используйте Tool
3. **API вызовы** - это действие, используйте Tool

## 🏗️ Структура Resource

```typescript
interface Resource {
  uri: string; // Уникальный идентификатор (e.g., "postgres://schema/all")
  name: string; // Программное имя (e.g., "database_schema")
  description?: string; // Описание содержимого
  mimeType?: string; // Тип контента (e.g., "application/json")
  title?: string; // Красивое имя для UI
  icons?: Array<{
    src: string; // URL или data URI
    mimeType?: string;
    sizes?: string[];
  }>;
}
```

### Содержимое ресурса (при чтении):

```typescript
// Текстовый контент
interface TextResourceContents {
  uri: string;
  text: string; // Текстовое содержимое
  mimeType?: string;
}

// Бинарный контент
interface BlobResourceContents {
  uri: string;
  blob: string; // base64-кодированные данные
  mimeType?: string;
}
```

## 🔧 Реализация на стороне сервера

### Пример: PostgreSQL MCP Server с Resources

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

class PgMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "sql-server", version: "1.0.0" },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}, // ← Включаем поддержку Resources
        },
      },
    );

    this.setupResourcesHandlers();
  }

  private setupResourcesHandlers(): void {
    // 1. Список доступных ресурсов
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "postgres://schema/all",
            name: "database_schema",
            description: "Полная схема базы данных",
            mimeType: "application/json",
          },
          {
            uri: "postgres://tables/list",
            name: "tables_list",
            description: "Список всех таблиц",
            mimeType: "application/json",
          },
        ],
      };
    });

    // 2. Чтение содержимого ресурса
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;

        if (uri === "postgres://schema/all") {
          // Получаем схему из базы данных
          const schema = await this.getDatabaseSchema();

          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(schema, null, 2),
              },
            ],
          };
        }

        throw new Error(`Unknown resource URI: ${uri}`);
      },
    );
  }
}
```

## 💻 Использование на стороне клиента

### Пример 1: Просмотр доступных ресурсов

```typescript
import { mcp } from "@llamaindex/tools";

const server = mcp({
  command: "node",
  args: ["server.js"],
  verbose: true,
});

// Получить список ресурсов
const resources = await server.resources();

resources.forEach((resource) => {
  console.log(`📦 ${resource.name}`);
  console.log(`   URI: ${resource.uri}`);
  console.log(`   Описание: ${resource.description}`);
});
```

### Пример 2: Чтение содержимого ресурса

```typescript
// Читаем ресурс по URI
const result = await server.readResource("postgres://schema/all");

if (result.contents && result.contents.length > 0) {
  const content = result.contents[0];

  if ("text" in content && content.text) {
    const data = JSON.parse(content.text);
    console.log("Схема базы данных:", data);
  }

  if ("blob" in content && content.blob) {
    // Декодируем base64 для бинарных данных
    const binaryData = Buffer.from(content.blob, "base64");
  }
}
```

### Пример 3: Использование в LLM агенте

```typescript
import { agent } from "@llamaindex/workflow";
import { openai } from "@llamaindex/openai";

// 1. Читаем ресурс как контекст
const schemaResource = await server.readResource("postgres://schema/all");
let dbSchemaContext = "";

if (schemaResource.contents && schemaResource.contents.length > 0) {
  const content = schemaResource.contents[0];
  if ("text" in content && content.text) {
    dbSchemaContext = content.text;
  }
}

// 2. Получаем инструменты
const tools = await server.tools();

// 3. Создаём агента с контекстом из ресурса
const myAgent = agent({
  name: "SQL Assistant",
  systemPrompt: `Ты - SQL аналитик.

СХЕМА БАЗЫ ДАННЫХ:
${dbSchemaContext}

Используй эту информацию для формирования SQL запросов.`,
  tools,
  llm: openai({ model: "gpt-4" }),
});

// 4. Запрос к агенту
const response = await myAgent.run("Какие таблицы есть в базе?");
```

## 🎨 Паттерны использования

### 1. Статические ресурсы

Ресурсы с фиксированным содержимым:

```typescript
// Сервер
if (uri === "app://config") {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(CONFIG, null, 2),
      },
    ],
  };
}
```

### 2. Динамические ресурсы

Ресурсы, содержимое которых генерируется по запросу:

```typescript
// Сервер
if (uri === "logs://latest") {
  const logs = await this.getRecentLogs();
  return {
    contents: [
      {
        uri,
        mimeType: "text/plain",
        text: logs.join("\n"),
      },
    ],
  };
}
```

### 3. Параметризованные ресурсы

Ресурсы с параметрами в URI:

```typescript
// URI: "user://profile/{userId}"
if (uri.startsWith("user://profile/")) {
  const userId = uri.replace("user://profile/", "");
  const profile = await this.getUserProfile(userId);
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(profile, null, 2),
      },
    ],
  };
}
```

## 🚀 Преимущества использования Resources

1. **Оптимизация контекста** - LLM получает структурированный контекст заранее
2. **Снижение количества вызовов Tools** - нет необходимости многократно запрашивать одни и те же данные
3. **Кеширование** - клиент может кешировать ресурсы
4. **Обновления** - сервер может уведомлять об изменениях ресурсов
5. **Типизация** - MIME types помогают правильно интерпретировать данные

## 📊 Resources vs Tools: Когда что использовать?

| Задача                  | Решение      | Причина                                 |
| ----------------------- | ------------ | --------------------------------------- |
| Получить схему БД       | **Resource** | Статический контекст, читается один раз |
| Выполнить SQL запрос    | **Tool**     | Действие с параметрами                  |
| Получить README проекта | **Resource** | Статический документ                    |
| Создать новый файл      | **Tool**     | Действие, изменяющее состояние          |
| Получить логи за вчера  | **Resource** | Данные для анализа                      |
| Отправить email         | **Tool**     | Действие с побочным эффектом            |

## 🔄 Обновления ресурсов (Resource Updates)

MCP поддерживает уведомления об изменениях:

```typescript
// Сервер может уведомить клиента об изменении списка ресурсов
this.server.sendResourceListChanged();

// Клиент может подписаться на обновления
await server.subscribeResource({ uri: "logs://latest" });

// И отписаться
await server.unsubscribeResource({ uri: "logs://latest" });
```

## 📝 Итоги

**Resources** — это мощный механизм для предоставления контекста LLM:

- ✅ Используйте для статических данных (схемы, документация)
- ✅ Используйте для контекста, который LLM читает
- ✅ Комбинируйте с Tools для полной функциональности
- ❌ Не используйте для действий (используйте Tools)
- ❌ Не дублируйте функциональность Tools

Правильное использование Resources снижает количество вызовов Tools и улучшает качество ответов LLM!
