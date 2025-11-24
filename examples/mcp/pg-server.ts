// src/sql-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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
        },
      },
    );

    // Конфигурация PostgreSQL
    this.client = new Client({
      host: "localhost",
      port: 5432,
      database: "demo",
      user: "postgres",
      password: "postgres",
    });
    this.setupToolHandlers();
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

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "execute_sql",
            description: "Execute a SQL SELECT query on PostgreSQL database",
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
              text: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private async executeSQL(args: { query: string }) {
    const { query } = args;

    // Валидация
    if (!query.trim().toUpperCase().startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }

    try {
      const result = await this.client.query(query);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows, null, 2),
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
      // Получаем информацию о колонках таблицы
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

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows, null, 2),
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
      // Получаем список всех таблиц
      const result = await this.client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'bookings'
      `);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows, null, 2),
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
      // Подключаемся к базе
      await this.connectDatabase();

      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      // Отключаем логирование
      // this.server.onerror = () => {};
      // this.server.onclose = () => {};
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

// Запуск
const server = new PgMcpServer();
server.run().catch(console.error);
