# Использование PostgreSQL MCP сервера

Этот документ описывает два подхода к работе с PostgreSQL через MCP (Model Context Protocol):

## 🔄 Два подхода

### 1. Собственный MCP сервер (`pg-server-new.ts`)

**Плюсы:**

- ✅ Полный контроль над инструментами
- ✅ Можно добавлять кастомные инструменты (например, `list_tables`, `get_table_schema`)
- ✅ Кастомизация ограничений (maxRows, maxColumns)
- ✅ Структурированные ответы с метаданными
- ✅ Поддержка промптов и ресурсов

**Минусы:**

- ❌ Нужно поддерживать код
- ❌ Больше кода для написания

**Инструменты:**

- `execute_sql` - выполнить SQL SELECT запрос
- `get_table_schema` - получить схему таблицы
- `list_tables` - список всех таблиц

### 2. Официальный PostgreSQL MCP (`@modelcontextprotocol/server-postgres`)

**Плюсы:**

- ✅ Готовое решение от Anthropic
- ✅ Не нужно писать код сервера
- ✅ Автоматические READ ONLY транзакции
- ✅ Ресурсы для схем таблиц

**Минусы:**

- ❌ Архивный проект (не поддерживается активно)
- ❌ Только один инструмент `query`
- ❌ Нет разделения на list_tables/get_schema
- ❌ Меньше гибкости

**Инструменты:**

- `query` - выполнить read-only SQL запрос (в READ ONLY транзакции)

**Ресурсы:**

- `postgres://{host}/{tableName}/schema` - схема конкретной таблицы

## 📁 Файлы

```
examples/mcp/
├── pg-server-new.ts              # ✨ Новый собственный MCP сервер (McpServer API)
├── pg-server.ts                  # 📦 Старый собственный MCP сервер (deprecated Server API)
├── llama-client.ts               # 🤖 Клиент с собственным сервером
├── llama-client-with-pg-mcp.ts   # 🔌 Клиент с официальным PG MCP
└── llm-logger.ts                 # 📊 Логгер токенов
```

## 🚀 Использование

### Вариант 1: Собственный сервер

```bash
# 1. Собрать сервер и клиент
npm run build

# 2. Запустить собственный сервер (в одном терминале)
node dist/server.bundle.js

# 3. Запустить клиент (в другом терминале)
node dist/client.bundle.js
```

### Вариант 2: Официальный PostgreSQL MCP

```bash
# 1. Собрать только клиент
npm run build

# 2. Запустить клиент (он сам запустит PG MCP через npx)
node dist/client-pg-mcp.bundle.js
```

## 🔧 Настройка официального PG MCP

Официальный сервер запускается автоматически через `npx` в коде:

```typescript
const pgServer = mcp({
  command: "npx",
  args: [
    "-y",
    "@modelcontextprotocol/server-postgres",
    "postgresql://postgres:postgres@localhost:5432/demo",
  ],
  verbose: true,
});
```

### Connection String формат:

```
postgresql://[user]:[password]@[host]:[port]/[database]
```

Пример:

```
postgresql://postgres:postgres@localhost:5432/demo
```

## 📊 Сравнение инструментов

| Функция            | Собственный сервер                | Официальный PG MCP                                          |
| ------------------ | --------------------------------- | ----------------------------------------------------------- |
| **Выполнение SQL** | `execute_sql(query)`              | `query(sql)`                                                |
| **Список таблиц**  | `list_tables()`                   | Нужно писать SQL: `SELECT * FROM information_schema.tables` |
| **Схема таблицы**  | `get_table_schema(table_name)`    | Через ресурс: `postgres://host/table/schema`                |
| **Транзакции**     | Обычный запрос                    | READ ONLY транзакция                                        |
| **Ограничения**    | Кастомные (100 строк, 10 колонок) | Без ограничений                                             |
| **Формат ответа**  | JSON с metadata                   | Прямой результат SQL                                        |

## 💡 Рекомендации

**Используйте собственный сервер если:**

- Нужен полный контроль над API
- Хотите добавить кастомные инструменты
- Важна структура ответов с метаданными
- Нужны промпты и ресурсы

**Используйте официальный PG MCP если:**

- Нужно быстро начать работу
- Достаточно одного универсального инструмента `query`
- Важна безопасность (READ ONLY транзакции)
- Не хотите поддерживать серверный код

## 🔍 Примеры запросов

### С собственным сервером:

```javascript
// Агент автоматически использует правильный инструмент:
"Какие таблицы есть в базе?"           → list_tables()
"Какая структура таблицы flights?"     → get_table_schema("flights")
"Какой самый дорогой билет?"           → execute_sql("SELECT ...")
```

### С официальным PG MCP:

```javascript
// Агенту нужно писать SQL для всего:
"Какие таблицы есть в базе?"           → query("SELECT table_name FROM information_schema.tables")
"Какая структура таблицы flights?"     → query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'flights'")
"Какой самый дорогой билет?"           → query("SELECT * FROM tickets ...")
```

## 📝 Логирование токенов

Оба варианта используют `llm-logger.ts` для отслеживания:

- Количества запросов к LLM
- Оценки input/output токенов
- Вызовов инструментов
- Сохранения логов в JSON

Логи сохраняются в `./logs/llm-log-{timestamp}.json`

## 🌐 Источники

- [Official PostgreSQL MCP Server (archived)](https://github.com/modelcontextprotocol/servers-archived/tree/main/src/postgres)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [@modelcontextprotocol/server-postgres on npm](https://www.npmjs.com/package/@modelcontextprotocol/server-postgres)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/examples)
