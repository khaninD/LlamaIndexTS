# Quick Start Guide

## 5-минутная настройка LlamaIndex Agent Server

### Предварительные требования

- Node.js 20+
- PostgreSQL база данных
- OpenAI API ключ

### Шаг 1: Сборка MCP сервера (2 мин)

```bash
cd D:\LlamaIndexTS\examples\mcp
npm install
npm run build
```

✅ Проверка: Файл `dist/server.bundle.js` создан

### Шаг 2: Настройка Agent Server (1 мин)

```bash
cd agent-server
npm install
cp .env.example .env
```

Отредактируйте `.env`:

```env
OPENAI_API_KEY=sk-your-key-here
PGHOST=localhost
PGDATABASE=your_db
PGUSER=your_user
PGPASSWORD=your_password
```

### Шаг 3: Запуск (30 сек)

```bash
npm run dev
```

✅ Проверка:

```bash
curl http://localhost:3001/health
# Должен вернуть: {"status":"ok","timestamp":"..."}
```

### Шаг 4: Тест запроса (30 сек)

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Покажи все таблицы",
    "apiKey": "sk-your-key-here"
  }'
```

### Шаг 5: Интеграция с Chatbot UI (1 мин)

```bash
cd D:\my_programs\chatbot-ui
# Добавьте в .env (опционально):
echo "LLAMAINDEX_AGENT_URL=http://localhost:3001" >> .env
npm run dev
```

В UI выберите модель "LlamaIndex SQL Agent" и начните общение!

## Docker Quick Start

```bash
cd D:\LlamaIndexTS\examples\mcp\agent-server

# Создайте .env файл (см. Шаг 2)
cp .env.example .env

# Запуск в Docker
docker-compose up -d

# Проверка
curl http://localhost:3001/health
```

## Troubleshooting

**Проблема**: MCP сервер не найден
**Решение**: Убедитесь, что собрали MCP сервер (Шаг 1)

**Проблема**: PostgreSQL connection failed
**Решение**: Проверьте credentials в `.env`

**Проблема**: OpenAI API error
**Решение**: Проверьте API ключ в `.env`

## Что дальше?

- Прочитайте [README.md](./README.md) для деталей
- Изучите [LLAMAINDEX_INTEGRATION.md](../../../chatbot-ui/LLAMAINDEX_INTEGRATION.md) для интеграции
- Деплой в production через Docker
