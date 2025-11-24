import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";

import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import {
  ContextChatEngine,
  Document,
  Settings,
  VectorStoreIndex,
} from "llamaindex";
import essay from "../data/essay";

// Update chunk size
Settings.chunkSize = 512;
Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-ada-002",
});
Settings.llm = new OpenAI({
  model: "gpt-4.1-nano",
});
async function main() {
  const document = new Document({ text: essay });
  const index = await VectorStoreIndex.fromDocuments([document]);
  const retriever = index.asRetriever({
    similarityTopK: 5,
  });
  const chatEngine = new ContextChatEngine({ retriever });
  const rl = readline.createInterface({ input, output });

  while (true) {
    const query = await rl.question("Query: ");
    const stream = await chatEngine.chat({ message: query, stream: true });
    console.log();
    for await (const chunk of stream) {
      process.stdout.write(chunk.response);
    }
  }
}

main().catch(console.error);
