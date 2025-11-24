import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import { Settings, VectorStoreIndex } from "llamaindex";
import { loadExcelWithOptimizedEmbeddings } from "./loadExcel";
const FILE_PATH =
  "C:\\Users\\Daniil\\LlamaIndexTS\\examples\\data\\tablitsa-ucheta-raskhodnykh-materialov.xls";

Settings.chunkSize = 512;
Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
});
Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});
async function testCurrentSearch() {
  const documents = await loadExcelWithOptimizedEmbeddings(FILE_PATH);
  const index = await VectorStoreIndex.fromDocuments(documents);

  console.log("🔍 ТЕСТИРУЕМ ПОИСК ПО АРТИКУЛАМ:");

  const testCases = [
    "8512",
    "6063",
    "963719",
    "артикул 8512",
    "код 8512",
    "товар 8512",
  ];

  for (const query of testCases) {
    console.log(`\n--- Запрос: "${query}" ---`);

    const retriever = index.asRetriever({ similarityTopK: 3 });
    const results = await retriever.retrieve(query);

    console.log(`Найдено: ${results.length} результатов`);

    results.forEach((result, i) => {
      const foundArticul = result.node.text?.match(/артикул:(\d+)/)?.[1];
      const foundName = result.node.text
        ?.match(/наименование:([^,]+)/)?.[1]
        ?.trim();
      console.log(
        `${i + 1}. Артикул: ${foundArticul}, Наименование: ${foundName}, Score: ${result.score.toFixed(4)}`,
      );
    });
  }
}

// Запустите этот тест
testCurrentSearch().catch(console.error);
