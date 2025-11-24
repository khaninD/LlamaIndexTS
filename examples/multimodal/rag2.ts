import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import fs from "fs/promises";
import {
  Document,
  extractText,
  getResponseSynthesizer,
  Settings,
  VectorStoreIndex,
} from "llamaindex";
import path from "path";
import { getStorageContext } from "./storage";

// Update chunk size and overlap
Settings.chunkSize = 512;
Settings.chunkOverlap = 20;

// Update llm
Settings.llm = new OpenAI({ model: "gpt-4-turbo", maxTokens: 512 });
Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-ada-002",
});

// Update callbackManager
Settings.callbackManager.on("retrieve-end", (event) => {
  const { nodes, query } = event.detail;
  const text = extractText(query);
  console.log(`Retrieved ${nodes.length} nodes for query: ${text}`);
});

async function loadDocuments() {
  // Пример загрузки документов - адаптируйте под ваш случай
  const documents = [];

  try {
    // Пример 1: Загрузка текстовых файлов
    const textPath = path.join(process.cwd(), "data", "van_gogh.txt");
    const textContent = await fs.readFile(textPath, "utf-8");
    documents.push(new Document({ text: textContent }));

    // Пример 2: Загрузка нескольких файлов из директории
    const dataDir = path.join(process.cwd(), "data");
    const files = await fs.readdir(dataDir);

    for (const file of files) {
      if (file.endsWith(".txt") || file.endsWith(".md")) {
        const filePath = path.join(dataDir, file);
        const content = await fs.readFile(filePath, "utf-8");
        documents.push(
          new Document({
            text: content,
            metadata: { filename: file },
          }),
        );
      }
    }
  } catch (error) {
    console.log("No documents found, creating sample document...");
    // Создаем sample документ если файлы не найдены
    const sampleText = `
      Vincent van Gogh was a Dutch post-impressionist painter who is among the most famous and influential figures in the history of Western art.
      Some of his most famous paintings include:
      - The Starry Night (1889) - Depicts a swirling night sky over a small town
      - Sunflowers (1888) - Series of still life paintings of sunflowers
      - The Potato Eaters (1885) - Early work showing peasant life
      - Irises (1889) - Painted while in an asylum in Saint-Rémy
      - The Bedroom (1888) - Depicts his bedroom in the Yellow House in Arles
      
      Van Gogh created about 2,100 artworks, including around 860 oil paintings, most of which date from the last two years of his life.
    `;
    documents.push(new Document({ text: sampleText }));
  }

  return documents;
}

async function main() {
  // Загружаем документы
  const documents = await loadDocuments();
  console.log(`Loaded ${documents.length} documents`);

  // Создаем индекс с документами
  const storageContext = await getStorageContext();
  const index = await VectorStoreIndex.fromDocuments(documents, {
    storageContext,
  });

  console.log("Index created successfully");

  const queryEngine = index.asQueryEngine({
    responseSynthesizer: getResponseSynthesizer("multi_modal"),
    retriever: index.asRetriever({ topK: { TEXT: 3, IMAGE: 1, AUDIO: 0 } }),
  });

  // Теперь запрос должен работать
  const stream = await queryEngine.query({
    query: "Tell me more about Vincent van Gogh's famous paintings",
    stream: true,
  });

  console.log("Streaming response:");
  for await (const chunk of stream) {
    process.stdout.write(chunk.response);
  }
  process.stdout.write("\n");
}

main().catch(console.error);
