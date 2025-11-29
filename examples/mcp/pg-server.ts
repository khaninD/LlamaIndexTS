// src/sql-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "pg";

class PgMcpServer {
  private server: Server;
  private client: Client;

  constructor() {
    this.server = new Server(
      {
        name: "sql-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      },
    );

    this.client = new Client({
      host: "localhost",
      port: 5432,
      database: "demo",
      user: "postgres",
      password: "postgres",
    });
    this.setupToolHandlers();
    this.setupPromptsHandlers();
    this.setupResourcesHandlers();
  }

  private async connectDatabase(): Promise<void> {
    try {
      await this.client.connect();
      console.log("Connected to PostgreSQL database");
    } catch (error) {
      console.error("Database connection failed:", error);
      throw error;
    }
  }
  private setupPromptsHandlers(): void {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: "json_response_required",
            description: "Требует всегда возвращать ответ в JSON формате",
            arguments: [],
          },
        ],
      };
    });
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name } = request.params;

      if (name === "json_response_required") {
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `ВСЕГДА возвращай ответ в строгом JSON формате. Даже если запрос на естественном языке, преобразуй результат в JSON.

ОСНОВНЫЕ ПРАВИЛА:
1. Используй инструменты для получения реальных данных из базы
2. Всегда возвращай структурированный JSON, никогда простой текст
3. Основные поля ответа: {"result": ..., "data": ..., "metadata": {...}}
4. Для ошибок: {"error": true, "message": "описание"}

ПРИМЕРЫ ФОРМАТОВ:

Для вопроса "Сколько всего рейсов?":
{
  "result": 15000,
  "data_source": "flights_table",
  "timestamp": "2024-01-01T12:00:00Z"
}

Для вопроса "В какой город летали чаще всего?":
{
  "analysis_type": "most_frequent_destination",
  "result": {
    "city": "Франкфурт",
    "iata_code": "FRA",
    "flight_count": 2104
  },
  "metadata": {
    "data_source": "flights",
    "row_count": 1
  }
}

НИКОГДА не возвращай простой текст! Всегда JSON!`,
              },
            },
          ],
        };
      }
    });
  }

  private setupResourcesHandlers(): void {
    // Список доступных ресурсов
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: "postgres://schema/all",
            name: "database_schema",
            description:
              "Полная схема базы данных со всеми таблицами и колонками",
            mimeType: "application/json",
          },
          {
            uri: "postgres://tables/list",
            name: "tables_list",
            description: "Список всех таблиц в базе данных",
            mimeType: "application/json",
          },
        ],
      };
    });

    // Чтение содержимого ресурса
    this.server.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const { uri } = request.params;

        if (uri === "postgres://schema/all") {
          // Получаем полную схему всех таблиц
          const tablesResult = await this.client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'bookings'
        `);

          const schema: Record<
            string,
            { columns: unknown[]; column_count: number | null }
          > = {};

          for (const row of tablesResult.rows) {
            const tableName = row.table_name;
            const columnsResult = await this.client.query(
              `
            SELECT
              column_name,
              data_type,
              is_nullable,
              column_default
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position
          `,
              [tableName],
            );

            schema[tableName] = {
              columns: columnsResult.rows,
              column_count: columnsResult.rowCount,
            };
          }

          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                  {
                    database: "demo",
                    schema: "bookings",
                    tables: schema,
                    total_tables: tablesResult.rowCount,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        if (uri === "postgres://tables/list") {
          // Получаем только список таблиц
          const result = await this.client.query(`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'bookings'
        `);

          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                  {
                    schema: "bookings",
                    tables: result.rows.map((row) => row.table_name),
                    count: result.rowCount,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        throw new Error(`Unknown resource URI: ${uri}`);
      },
    );
  }
  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "execute_sql",
            description:
              "Execute a SQL SELECT query on PostgreSQL database and return results as structured JSON",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "SQL SELECT query to execute",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "get_table_schema",
            description: "Get the schema of a PostgreSQL table",
            inputSchema: {
              type: "object",
              properties: {
                table_name: {
                  type: "string",
                  description: "Name of the table",
                },
              },
              required: ["table_name"],
            },
          },
          {
            name: "list_tables",
            description: "List all available tables in PostgreSQL database",
            inputSchema: {
              type: "object",
              properties: {},
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "execute_sql":
            return await this.executeSQL(args as { query: string });
          case "get_table_schema":
            return await this.getTableSchema(args as { table_name: string });
          case "list_tables":
            return await this.listTables();
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: true,
                  message:
                    error instanceof Error ? error.message : "Unknown error",
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async executeSQL(args: { query: string }) {
    const { query } = args;

    if (!query.trim().toUpperCase().startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }

    try {
      const result = await this.client.query(query);

      const structuredResult = {
        success: true,
        data: result.rows,
        rowCount: result.rowCount,
        columns: result.fields.map((field) => ({
          name: field.name,
          dataType: field.dataTypeID,
        })),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(structuredResult, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `SQL error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async getTableSchema(args: { table_name: string }) {
    const { table_name } = args;

    try {
      const result = await this.client.query(
        `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `,
        [table_name],
      );

      if (result.rows.length === 0) {
        throw new Error(`Table '${table_name}' not found`);
      }

      const structuredResult = {
        success: true,
        table: table_name,
        schema: result.rows,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(structuredResult, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Schema error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private async listTables() {
    try {
      const result = await this.client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'bookings'
      `);

      const structuredResult = {
        success: true,
        tables: result.rows.map((row) => row.table_name),
        count: result.rowCount,
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(structuredResult, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `List tables error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  async run(): Promise<void> {
    try {
      await this.connectDatabase();
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

const server = new PgMcpServer();
server.run().catch(console.error);
