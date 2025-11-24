import { openai } from "@llamaindex/openai";
import { mcp } from "@llamaindex/tools";
import { agent } from "@llamaindex/workflow";

const server = mcp({
  command: "node",
  args: ["C:\\Users\\Daniil\\LlamaIndexTS\\examples\\dist\\server.bundle.js"],
  verbose: true,
});

async function main() {
  // 3. Get tools from MCP server
  const tools = await server.tools();
  // Now you can create an agent with the tools
  try {
    // Create an agent that uses the MCP tools
    const myAgent = agent({
      name: "Assistant",
      systemPrompt: "Используй инструменты для выполнения задачи.",
      tools: await server.tools(),
      llm: openai({ model: "gpt-4.1-nano" }),
      verbose: true,
    });

    // Run a task
    const response = await myAgent.run("В какой город летали чаще всего?");
    console.log(response.data.result);
  } finally {
    await server.cleanup();
  }
}

main().catch(console.error);
