import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import { z } from "zod";

class CorrectSQLMcpServer {
  private server: McpServer;
  private db: Database.Database;

  constructor() {
    this.server = new McpServer({
      name: "sql-server",
      version: "1.0.0",
    });

    this.db = new Database(":memory:");
    this.initializeSampleData();
    this.setupTools();
  }

  private initializeSampleData(): void {
    // Таблица пользователей
    this.db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        age INTEGER,
        city TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Таблица заказов
    this.db.exec(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_name TEXT NOT NULL,
        amount DECIMAL(10,2),
        status TEXT DEFAULT 'pending',
        order_date DATE,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Тестовые данные
    const insertUser = this.db.prepare(`
      INSERT INTO users (name, email, age, city) VALUES (?, ?, ?, ?)
    `);

    const users = [
      ["Алексей Петров", "alexey@example.com", 28, "Москва"],
      ["Мария Сидорова", "maria@example.com", 32, "Санкт-Петербург"],
      ["Иван Иванов", "ivan@example.com", 25, "Казань"],
      ["Елена Кузнецова", "elena@example.com", 29, "Москва"],
      ["Дмитрий Смирнов", "dmitry@example.com", 35, "Новосибирск"],
    ];

    users.forEach((user) => insertUser.run(user));

    const insertOrder = this.db.prepare(`
      INSERT INTO orders (user_id, product_name, amount, status, order_date)
      VALUES (?, ?, ?, ?, ?)
    `);

    const orders = [
      [1, "Ноутбук MacBook Pro", 250000.0, "completed", "2024-01-15"],
      [1, "Мышь беспроводная", 4500.0, "completed", "2024-01-20"],
      [2, "Смартфон iPhone 15", 120000.0, "shipped", "2024-02-01"],
      [3, "Наушники Sony", 25000.0, "pending", "2024-02-05"],
      [4, "Планшет iPad", 80000.0, "completed", "2024-01-25"],
      [4, "Чехол для планшета", 3000.0, "completed", "2024-01-26"],
      [5, 'Монитор 27"', 45000.0, "shipped", "2024-02-03"],
      [2, "Клавиатура механическая", 15000.0, "pending", "2024-02-10"],
    ];

    orders.forEach((order) => insertOrder.run(order));

    console.error("✅ Sample database initialized with test data");
  }

  private setupTools(): void {
    this.server.registerTool(
      "test_tool",
      {
        title: "Test Tool",
        description: "A simple test tool that returns a greeting message.",
        inputSchema: {},
      },
      async () => {
        return {
          content: [
            {
              type: "text",
              text: "Hello from the Test Tool!",
            },
          ],
        };
      },
    );
    // Инструмент для выполнения SQL запросов
    this.server.registerTool(
      "execute_sql",
      {
        title: "Execute SQL Query",
        description:
          "Execute a SQL SELECT query on the database. Use for data analysis, filtering, joining tables. ONLY READ-ONLY QUERIES.",
        inputSchema: {
          //@ts-expect-error - inputSchema expects a specific format but we're using zod schema
          query: z.string().describe("SQL SELECT query to execute"),
        },
      },
      async ({ query }: { query: string }) => {
        // Валидация
        if (!query.trim().toUpperCase().startsWith("SELECT")) {
          throw new Error("Only SELECT queries are allowed");
        }

        try {
          const stmt = this.db.prepare(query);
          const rows = stmt.all();

          const result = {
            content: [
              {
                type: "text",
                text: JSON.stringify(rows, null, 2),
              },
            ],
          };

          return result;
        } catch (error) {
          throw new Error(
            `SQL error: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      },
    );

    // Инструмент для получения схемы таблицы
    this.server.registerTool(
      "get_table_schema",
      {
        title: "Get Table Schema",
        description:
          "Get the schema of a table including column names and types",
        inputSchema: {
          //@ts-expect-error - inputSchema expects a specific format but we're using zod schema
          table_name: z.string().describe("Name of the table"),
        },
      },
      async ({ table_name }: { table_name: string }) => {
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
      },
    );

    // Инструмент для списка таблиц
    this.server.registerTool(
      "list_tables",
      {
        title: "List Tables",
        description: "List all available tables in the database",
        inputSchema: {},
      },
      async () => {
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
      },
    );
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(
      "✅ SQL MCP Server ready - waiting for SQL queries from Claude...",
    );
  }
}

// Запуск
const server = new CorrectSQLMcpServer();

server.run().catch(console.error);
