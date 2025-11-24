// src/sql-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  InitializeRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";

class CorrectSQLMcpServer {
  private server: Server;
  private db: Database.Database;

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

    this.server.oninitialized = () => {
      console.error("✅ MCP Server initialized with client");
    };

    this.db = new Database(":memory:");
    // this.initializeSampleData();
    this.setupToolHandlers();
  }

  // private initializeSampleData(): void {
  //   // Таблица пользователей
  //   this.db.exec(`
  //     CREATE TABLE users (
  //       id INTEGER PRIMARY KEY AUTOINCREMENT,
  //       name TEXT NOT NULL,
  //       email TEXT UNIQUE NOT NULL,
  //       age INTEGER,
  //       city TEXT,
  //       created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  //     )
  //   `);

  //   // Таблица заказов
  //   this.db.exec(`
  //     CREATE TABLE orders (
  //       id INTEGER PRIMARY KEY AUTOINCREMENT,
  //       user_id INTEGER,
  //       product_name TEXT NOT NULL,
  //       amount DECIMAL(10,2),
  //       status TEXT DEFAULT 'pending',
  //       order_date DATE,
  //       FOREIGN KEY (user_id) REFERENCES users (id)
  //     )
  //   `);

  //   // Тестовые данные
  //   const insertUser = this.db.prepare(`
  //     INSERT INTO users (name, email, age, city) VALUES (?, ?, ?, ?)
  //   `);

  //   const users = [
  //     ["Алексей Петров", "alexey@example.com", 28, "Москва"],
  //     ["Мария Сидорова", "maria@example.com", 32, "Санкт-Петербург"],
  //     ["Иван Иванов", "ivan@example.com", 25, "Казань"],
  //     ["Елена Кузнецова", "elena@example.com", 29, "Москва"],
  //     ["Дмитрий Смирнов", "dmitry@example.com", 35, "Новосибирск"],
  //   ];

  //   users.forEach((user) => insertUser.run(user));

  //   const insertOrder = this.db.prepare(`
  //     INSERT INTO orders (user_id, product_name, amount, status, order_date)
  //     VALUES (?, ?, ?, ?, ?)
  //   `);

  //   const orders = [
  //     [1, "Ноутбук MacBook Pro", 250000.0, "completed", "2024-01-15"],
  //     [1, "Мышь беспроводная", 4500.0, "completed", "2024-01-20"],
  //     [2, "Смартфон iPhone 15", 120000.0, "shipped", "2024-02-01"],
  //     [3, "Наушники Sony", 25000.0, "pending", "2024-02-05"],
  //     [4, "Планшет iPad", 80000.0, "completed", "2024-01-25"],
  //     [4, "Чехол для планшета", 3000.0, "completed", "2024-01-26"],
  //     [5, 'Монитор 27"', 45000.0, "shipped", "2024-02-03"],
  //     [2, "Клавиатура механическая", 15000.0, "pending", "2024-02-10"],
  //   ];

  //   orders.forEach((order) => insertOrder.run(order));

  //   console.error("✅ Sample database initialized with test data");
  // }

  private setupToolHandlers(): void {
    // Обработчик initialize
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      console.error(
        "✅ Received initialize request from client:",
        request.params.clientInfo?.name,
      );
      return {
        protocolVersion: "2025-06-18",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "sql-server",
          version: "1.0.0",
        },
        metadata: {},
      };
    });
    // Сервер предоставляет ТОЛЬКО общие инструменты
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "execute_sql",
            description:
              "Execute a SQL SELECT query on the database. Use for data analysis, filtering, joining tables. ONLY READ-ONLY QUERIES.",
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
            description:
              "Get the schema of a table including column names and types",
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
            description: "List all available tables in the database",
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
            // Сервер только ВЫПОЛНЯЕТ SQL, который сгенерировал клиент
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
              text: `SQL Error: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private executeSQL(args: { query: string }) {
    const { query } = args;

    // Валидация
    if (!query.trim().toUpperCase().startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }

    try {
      const stmt = this.db.prepare(query);
      const rows = stmt.all();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `SQL error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private getTableSchema(args: { table_name: string }) {
    const { table_name } = args;

    try {
      const stmt = this.db.prepare(`PRAGMA table_info(${table_name})`);
      const rows = stmt.all();

      if (rows.length === 0) {
        throw new Error(`Table '${table_name}' not found`);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(
        `Schema error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private listTables() {
    try {
      const stmt = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );
      const rows = stmt.all();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
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
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // Отключаем логирование
    this.server.onerror = (error) => {
      console.log("SQL MCP Server error:", error);
    };
    this.server.onclose = () => {};
    console.error(
      "✅ SQL MCP Server ready - waiting for SQL queries from Claude...",
    );
  }
}

// Запуск
const server = new CorrectSQLMcpServer();
server.run().catch(console.error);
