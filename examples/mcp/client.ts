import { MCPClient } from "mcp-client";

async function main() {
  const client = new MCPClient({
    name: "Test",
    version: "1.0.0",
  });

  try {
    await client.connect({
      type: "stdio",
      command: "node",
      args: [
        "C:\\Users\\Daniil\\LlamaIndexTS\\examples\\dist\\server.bundle.js",
      ],
    });
    console.log("Connected to MCP server");

    await client.ping();
    console.log("Ping successful");
    const tools = await client.getAllTools();
    console.log("Available tools:", tools);
    // Тестируем инструменты
    const tables = await client.callTool({
      name: "list_tables",
      arguments: {},
    });
    console.log("Tables:", tables);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
