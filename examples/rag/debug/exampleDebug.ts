import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { Settings, VectorStoreIndex } from "llamaindex";
import debugSearch from "./debugSearch";
import { loadExcelWithArticulOptimization } from "./loadExcel";
const FILE_PATH =
  "C:\\Users\\Daniil\\LlamaIndexTS\\examples\\data\\tablica-ucheta.xlsx";

Settings.chunkSize = 512;
Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
});
Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
  maxTokens: 1000,
});

async function main() {
  console.log("🚀 ЗАПУСК ПОЛНОЙ ДИАГНОСТИКИ");

  // Загружаем документы
  const documents = await loadExcelWithArticulOptimization(FILE_PATH);

  console.log(`\n📁 Загружено документов: ${documents.length}`);

  // Создаем индекс
  const index = await VectorStoreIndex.fromDocuments(documents);

  // // Запускаем все виды диагностики
  // await debugVectorStore(index);
  // await debugChunks(index);

  // Тестируем конкретные запросы
  const testQueries = [
    "8512",
    "Таулетная бумага Миниджамбо",
    "артикул 8512",
    "бумага",
    "несуществующий артикул 9999",
  ];

  for (const query of testQueries) {
    await debugSearch(index, query);
    // await debugEmbeddings(index, query);
  }

  console.log("\n✅ ДИАГНОСТИКА ЗАВЕРШЕНА");
}

main().catch(console.error);
