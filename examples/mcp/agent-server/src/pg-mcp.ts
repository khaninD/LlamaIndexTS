#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import pg from "pg";

const { Pool } = pg;

interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

interface ConnectDbArgs {
  host: string;
  port?: number;
  database: string;
  user: string;
  password: string;
}

interface ListTablesArgs {
  schema?: string;
}

interface DescribeTableArgs {
  schema?: string;
  table: string;
}

interface QueryArgs {
  sql: string;
  params?: Array<string | number | boolean | null>;
}

class PostgresMCPServer {
  private server: Server;
  private pool: pg.Pool | null = null;
  private config: PostgresConfig | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "postgres-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupHandlers();
    this.setupErrorHandling();
    this.autoConnect();
  }

  private async autoConnect(): Promise<void> {
    // Auto-connect if environment variables are present
    const host = process.env.PG_HOST;
    const database = process.env.PG_DATABASE;
    const user = process.env.PG_USER;
    const password = process.env.PG_PASSWORD;

    if (host && database && user && password) {
      try {
        const port = process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5432;

        this.pool = new Pool({
          host,
          port,
          database,
          user,
          password,
        });

        this.config = { host, port, database, user, password };

        // Test connection
        const client = await this.pool.connect();
        await client.query("SELECT 1");
        client.release();

        console.error(
          `Auto-connected to PostgreSQL database '${database}' at ${host}:${port}`,
        );
      } catch (error) {
        console.error(
          `Auto-connect failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        if (this.pool) {
          await this.pool.end();
          this.pool = null;
        }
      }
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  private async cleanup(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: "connect_db",
          description:
            "Connect to a PostgreSQL database. Provide connection parameters.",
          inputSchema: {
            type: "object",
            properties: {
              host: {
                type: "string",
                description: "Database host (e.g., localhost)",
              },
              port: {
                type: "number",
                description: "Database port (default: 5432)",
                default: 5432,
              },
              database: {
                type: "string",
                description: "Database name",
              },
              user: {
                type: "string",
                description: "Database user",
              },
              password: {
                type: "string",
                description: "Database password",
              },
            },
            required: ["host", "user", "password", "database"],
          },
        },
        {
          name: "list_schemas",
          description: "List all schemas in the connected database",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "list_tables",
          description: "List all tables in a schema",
          inputSchema: {
            type: "object",
            properties: {
              schema: {
                type: "string",
                description: "Schema name (default: public)",
                default: "public",
              },
            },
          },
        },
        {
          name: "describe_table",
          description:
            "Get detailed information about a table's structure (columns, types, constraints)",
          inputSchema: {
            type: "object",
            properties: {
              schema: {
                type: "string",
                description: "Schema name (default: public)",
                default: "public",
              },
              table: {
                type: "string",
                description: "Table name",
              },
            },
            required: ["table"],
          },
        },
        {
          name: "query",
          description:
            "Execute a SELECT or WITH (CTE) query on the database. Returns query results.",
          inputSchema: {
            type: "object",
            properties: {
              sql: {
                type: "string",
                description:
                  "SQL SELECT or WITH query to execute (use $1, $2, etc. for parameters)",
              },
              params: {
                type: "array",
                description: "Optional array of query parameters",
                items: {
                  type: ["string", "number", "boolean", "null"],
                },
              },
            },
            required: ["sql"],
          },
        },
      ];

      return { tools };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "connect_db":
            return await this.handleConnect(args as unknown as ConnectDbArgs);

          case "list_schemas":
            return await this.handleListSchemas();

          case "list_tables":
            return await this.handleListTables(
              (args as unknown as ListTablesArgs) ?? {},
            );

          case "describe_table":
            return await this.handleDescribeTable(
              args as unknown as DescribeTableArgs,
            );

          case "query":
            return await this.handleQuery(args as unknown as QueryArgs);

          default:
            return {
              content: [
                {
                  type: "text",
                  text: `Unknown tool: ${name}`,
                },
              ],
              isError: true,
            };
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private ensureConnected(): void {
    if (!this.pool) {
      throw new Error(
        "Not connected to database. Either use the connect_db tool or configure environment variables (PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE).",
      );
    }
  }

  private async handleConnect(args: ConnectDbArgs) {
    try {
      // Close existing connection if any
      if (this.pool) {
        await this.pool.end();
      }

      const config: PostgresConfig = {
        host: args.host,
        port: args.port || 5432,
        database: args.database,
        user: args.user,
        password: args.password,
      };

      this.pool = new Pool(config);
      this.config = config;

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query("SELECT version()");
      client.release();

      return {
        content: [
          {
            type: "text",
            text: `Successfully connected to PostgreSQL database '${config.database}' at ${config.host}:${config.port}\n\nServer version:\n${result.rows[0].version}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to connect to database: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListSchemas() {
    this.ensureConnected();

    const query = `
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schema_name;
    `;

    const result = await this.pool!.query(query);
    const schemas = result.rows.map((row) => row.schema_name);

    return {
      content: [
        {
          type: "text",
          text: `Found ${schemas.length} schema(s):\n\n${schemas.join("\n")}`,
        },
      ],
    };
  }

  private async handleListTables(args: ListTablesArgs) {
    this.ensureConnected();

    const schema = args.schema || "public";

    const query = `
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = $1
      ORDER BY table_name;
    `;

    const result = await this.pool!.query(query, [schema]);

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No tables found in schema '${schema}'`,
          },
        ],
      };
    }

    const tableList = result.rows
      .map((row) => `${row.table_name} (${row.table_type})`)
      .join("\n");

    return {
      content: [
        {
          type: "text",
          text: `Found ${result.rows.length} table(s) in schema '${schema}':\n\n${tableList}`,
        },
      ],
    };
  }

  private async handleDescribeTable(args: DescribeTableArgs) {
    this.ensureConnected();

    const schema = args.schema || "public";
    const table = args.table;

    if (!table) {
      throw new Error("Table name is required");
    }

    // Get column information
    const columnQuery = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;

    const columnResult = await this.pool!.query(columnQuery, [schema, table]);

    if (columnResult.rows.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Table '${schema}.${table}' not found`,
          },
        ],
        isError: true,
      };
    }

    // Get primary key information
    const pkQuery = `
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary;
    `;

    const pkResult = await this.pool!.query(pkQuery, [`${schema}.${table}`]);
    const primaryKeys = pkResult.rows.map((row) => row.attname);

    // Get foreign key information
    const fkQuery = `
      SELECT
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2;
    `;

    const fkResult = await this.pool!.query(fkQuery, [schema, table]);

    let output = `Table: ${schema}.${table}\n\n`;
    output += "Columns:\n";
    output += "-".repeat(80) + "\n";

    for (const col of columnResult.rows) {
      const isPK = primaryKeys.includes(col.column_name);
      const fk = fkResult.rows.find((fk) => fk.column_name === col.column_name);

      let colInfo = `${col.column_name.padEnd(30)} ${col.data_type}`;

      if (col.character_maximum_length) {
        colInfo += `(${col.character_maximum_length})`;
      }

      colInfo += `\t${col.is_nullable === "NO" ? "NOT NULL" : "NULL"}`;

      if (col.column_default) {
        colInfo += `\tDEFAULT ${col.column_default}`;
      }

      if (isPK) {
        colInfo += `\tPRIMARY KEY`;
      }

      if (fk) {
        colInfo += `\tFK -> ${fk.foreign_table_schema}.${fk.foreign_table_name}(${fk.foreign_column_name})`;
      }

      output += colInfo + "\n";
    }

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }

  private async handleQuery(args: QueryArgs) {
    this.ensureConnected();

    const sql = args.sql;
    const params = args.params || [];

    if (!sql) {
      throw new Error("SQL query is required");
    }

    // Basic validation to ensure it's a read-only query (SELECT or CTE with WITH)
    const trimmedSql = sql.trim().toLowerCase();
    if (!trimmedSql.startsWith("select") && !trimmedSql.startsWith("with")) {
      throw new Error(
        "Only SELECT and WITH (CTE) queries are allowed. Use 'query' tool for read operations only.",
      );
    }

    const result = await this.pool!.query(sql, params);

    if (result.rows.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Query executed successfully. No rows returned.",
          },
        ],
      };
    }

    // Format results as a table
    const columns = Object.keys(result.rows[0]);
    let output = `Query returned ${result.rows.length} row(s)\n\n`;

    // Create header
    output += columns.join(" | ") + "\n";
    output += columns.map(() => "-".repeat(20)).join("-+-") + "\n";

    // Add rows (limit to first 100 rows for display)
    const displayRows = result.rows.slice(0, 100);
    for (const row of displayRows) {
      output +=
        columns
          .map((col) =>
            String((row as Record<string, unknown>)[col] ?? "NULL").padEnd(20),
          )
          .join(" | ") + "\n";
    }

    if (result.rows.length > 100) {
      output += `\n... and ${result.rows.length - 100} more row(s)`;
    }

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("PostgreSQL MCP Server running on stdio");
  }
}

const server = new PostgresMCPServer();
server.run().catch(console.error);
