import { ExcelReader } from "@llamaindex/excel";
import { stdin as input, stdout as output } from "node:process";
import readline from "node:readline/promises";

import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import {
  ContextChatEngine,
  Document,
  Settings,
  VectorStoreIndex,
} from "llamaindex";

const FILE_PATH =
  "C:\\Users\\Daniil\\LlamaIndexTS\\examples\\data\\tablitsa-ucheta-raskhodnykh-materialov.xls";

Settings.chunkSize = 512;
Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
});
Settings.llm = new OpenAI({
  model: "gpt-4.1-nano",
});

async function loadExcelDocument(filePath: string): Promise<Document[]> {
  const reader = new ExcelReader({
    sheetSpecifier: 0,
    concatRows: false,
  });
  const docs = await reader.loadData(filePath);

  // ОПТИМИЗИРУЕМ для векторного поиска
  const optimizedDocs = docs.map((doc) => {
    const text = doc.text || "";
    const articulMatch = text.match(/артикул:(\d+)/);
    const nameMatch = text.match(/наименование:([^,]+)/);

    if (articulMatch && nameMatch) {
      const articul = articulMatch[1];
      const name = nameMatch[1];

      // ОБОГАЩЕННЫЙ ТЕКСТ для поиска
      const searchText = `
        АРТИКУЛ: ${articul}
        НАИМЕНОВАНИЕ: ${name}
        
        ПОИСКОВЫЕ КЛЮЧИ:
        - артикул ${articul}
        - код ${articul}
        - номер ${articul} 
        - товар ${articul}
        - материал ${articul}
        - ID ${articul}
        - SKU ${articul}
        - ${articul} ${name}
        
        ОРИГИНАЛЬНЫЕ ДАННЫЕ АРТИКУЛ: ${articul}
        НАИМЕНОВАНИЕ: ${name}
        
        ПОИСКОВЫЕ КЛЮЧИ:
        - артикул ${articul}
        - код ${articul}
        - номер ${articul} 
        - товар ${articul}
        - материал ${articul}
        - ID ${articul}
        - SKU ${articul}
        - ${articul} ${name}
        
        ОРИГИНАЛЬНЫЕ ДАННЫЕ:
        ${text}
      `;

      return new Document({
        text: searchText,
        metadata: { articul, name, search_optimized: true },
      });
    }

    return doc;
  });

  console.log(`Создано ${optimizedDocs.length} оптимизированных документов`);
  return optimizedDocs;
}

async function main() {
  console.log("🔄 Загрузка и оптимизация данных...");
  const documents = await loadExcelDocument(FILE_PATH);

  console.log("🔄 Создание векторного индекса...");
  const index = await VectorStoreIndex.fromDocuments(documents);

  const rl = readline.createInterface({ input, output });

  console.log("=== ОПТИМИЗИРОВАННЫЙ ВЕКТОРНЫЙ ПОИСК ===");
  console.log("Документов:", documents.length);
  console.log("Поиск работает по: артикулам, кодам, номерам, ID\n");

  while (true) {
    const query = await rl.question("Query: ").then((q) => q.trim());
    // Динамически меняем topK в зависимости от запроса
    let similarityTopK = 5;

    if (
      query.toLowerCase().includes("все артикулы") ||
      query.toLowerCase().includes("перечисли все") ||
      query.toLowerCase().includes("список артикулов")
    ) {
      similarityTopK = documents.length;
    }
    try {
      console.log("similarityTopK", similarityTopK);
      const retriever = index.asRetriever({ similarityTopK });
      const chatEngine = new ContextChatEngine({
        retriever,
        systemPrompt:
          "Ты помогаешь найти товары по артикулам и наименованиям. Отвечай точно.",
      });
      const response = await chatEngine.chat({
        message: query,
        stream: true,
      });

      console.log("🔍 Результат поиска:");
      for await (const chunk of response) {
        process.stdout.write(chunk.response);
      }
      console.log("\n");
    } catch (error) {
      console.log("❌ Ошибка:", error, "\n");
    }
  }
}

main().catch(console.error);
