# LlamaIndex Agent Server

Standalone HTTP server for LlamaIndex SQL Agent with MCP (Model Context Protocol).

## Features

- RESTful API for SQL agent queries
- MCP integration for database tools
- Docker support
- Health check endpoint
- Streaming support (coming soon)

## Quick Start

### Local Development

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Build MCP server (one-time):

```bash
cd ../
npm run build
```

4. Start development server:

```bash
npm run dev
```

Server will be running on `http://localhost:3001`

### Production Build

```bash
npm run build
npm start
```

### Docker

1. Build image:

```bash
docker build -t llamaindex-agent-server .
```

2. Run container:

```bash
docker run -p 3001:3001 --env-file .env llamaindex-agent-server
```

### Docker Compose

```bash
docker-compose up -d
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Chat with Agent

```bash
POST /api/chat
Content-Type: application/json

{
  "query": "Какой самый дорогой билет?",
  "systemPrompt": "Optional custom system prompt",
  "apiKey": "Optional OpenAI API key"
}
```

Response:

```json
{
  "success": true,
  "result": {
    // Agent response
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Streaming (Coming Soon)

```bash
POST /api/chat/stream
```

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3001)
- `OPENAI_API_KEY` - OpenAI API key (can be passed in request)
- `OPENAI_MODEL` - OpenAI model to use (default: gpt-4o)
- `MCP_SERVER_PATH` - Path to MCP server bundle
- `VERBOSE` - Enable verbose logging (default: false)
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD` - PostgreSQL connection

### MCP Server Path

The agent requires a built MCP server. Default path:

```
D:\LlamaIndexTS\examples\dist\server.bundle.js
```

You can override this with `MCP_SERVER_PATH` environment variable.

## Integration with Chatbot UI

The server is designed to work with [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui).

Configure chatbot-ui to use this server:

1. Set environment variable in chatbot-ui:

```env
LLAMAINDEX_AGENT_URL=http://localhost:3001
```

2. Select "LlamaIndex SQL Agent" model in the UI

## Docker Deployment

### Build and Run

```bash
# Build
docker-compose build

# Start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Environment Variables in Docker

Create `.env` file:

```env
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4o
PGHOST=your-db-host
PGDATABASE=your-db-name
PGUSER=your-db-user
PGPASSWORD=your-db-password
```

## Example Usage

### Using curl

```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Покажи все таблицы",
    "apiKey": "sk-..."
  }'
```

### Using JavaScript

```javascript
const response = await fetch("http://localhost:3001/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query: "Какой самый дорогой билет?",
    apiKey: "sk-...",
  }),
});

const data = await response.json();
console.log(data.result);
```

## Troubleshooting

### MCP Server Not Found

Ensure the MCP server is built:

```bash
cd ../
npm run build
```

### Connection Refused

Check if server is running:

```bash
curl http://localhost:3001/health
```

### Database Connection Issues

Verify PostgreSQL credentials in `.env` file.

### OpenAI API Errors

- Check API key is valid
- Ensure you have credits
- Verify model name is correct

## Development

### Project Structure

```
agent-server/
├── src/
│   ├── server.ts    # Express server
│   └── agent.ts     # LlamaIndex agent logic
├── dist/            # Compiled JavaScript
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript
- `npm start` - Start production server
- `npm run docker:build` - Build Docker image
- `npm run docker:run` - Run Docker container

## License

MIT
