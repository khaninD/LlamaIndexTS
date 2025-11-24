import { ExcelReader } from "@llamaindex/excel";
import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";
import {
  Document,
  RetrieverQueryEngine,
  Settings,
  VectorStoreIndex,
  getResponseSynthesizer,
} from "llamaindex";

const FILE_PATH =
  "C:\\Users\\Daniil\\LlamaIndexTS\\examples\\data\\tablica-ucheta.xlsx";

Settings.chunkSize = 512;
Settings.embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-small",
});
Settings.llm = new OpenAI({
  model: "gpt-4o-mini",
});

async function loadOptimizedDocuments(filePath: string): Promise<Document[]> {
  const reader = new ExcelReader({ sheetSpecifier: 0, concatRows: false });
  const rawDocs = await reader.loadData(filePath);

  return rawDocs.map((rawDoc) => {
    const text = rawDoc.text || "";
    const articulMatch = text.match(/артикул:([^,]+)/);
    const nameMatch = text.match(/наименование:([^,]+)/);

    if (articulMatch && nameMatch) {
      const articul = articulMatch[1].trim();
      const name = nameMatch[1].trim();

      const optimizedText = `
        ТОВАР: ${name}
        АРТИКУЛ: ${articul}
        КОД: ${articul}
        
        ДЛЯ ПОИСКА: артикул ${articul}, код ${articul}, товар ${articul}
        
        ПОЛНЫЕ ДАННЫЕ:
        ${text}
      `;

      return new Document({
        text: optimizedText,
        id_:
          articul !== "-"
            ? `articul_${articul}`
            : `no_articul_${name.substring(0, 20)}`,
        metadata: {
          ...rawDoc.metadata,
          articul: articul !== "-" ? articul : null,
          name: name,
        },
      });
    }

    return rawDoc;
  });
}

// Создаем QueryEngine с разными стратегиями
function createQueryEngine(
  index: VectorStoreIndex,
  strategy: "compact" | "refine",
): RetrieverQueryEngine {
  return index.asQueryEngine({
    responseSynthesizer: getResponseSynthesizer(strategy),
    retriever: index.asRetriever({ similarityTopK: 5 }),
  });
}

// Умный поиск с GPT
async function smartSearchWithGPT(query: string) {
  console.log(`\n🔍 ЗАПУСК GPT ПОИСКА: "${query}"`);

  const documents = await loadOptimizedDocuments(FILE_PATH);
  const index = await VectorStoreIndex.fromDocuments(documents);

  // Тестируем разные стратегии
  const strategies = ["compact", "refine"] as const;

  for (const strategy of strategies) {
    console.log(`\n--- Стратегия: ${strategy.toUpperCase()} ---`);

    try {
      const queryEngine = createQueryEngine(index, strategy);
      const startTime = Date.now();

      const response = await queryEngine.query({
        query: query,
        stream: false,
      });

      const endTime = Date.now();

      console.log(`⏱️ Время выполнения: ${endTime - startTime}ms`);
      console.log(`🤖 Ответ GPT:`);
      console.log(response.response);

      // Показываем источники
      if (response.sourceNodes && response.sourceNodes.length > 0) {
        console.log(
          `\n📚 Использованные источники (${response.sourceNodes.length}):`,
        );
        response.sourceNodes.forEach((node, i) => {
          const articul = node.node.text?.match(/артикул:([^,]+)/)?.[1]?.trim();
          const name = node.node.text
            ?.match(/наименование:([^,]+)/)?.[1]
            ?.trim();
          console.log(
            `${i + 1}. Артикул: ${articul} - ${name?.substring(0, 40)}...`,
          );
        });
      }
    } catch (error) {
      console.log(`❌ Ошибка в стратегии ${strategy}:`, error.message);
    }
  }
}

// Тестируем конкретные запросы
async function testGPTQueries() {
  console.log("🧪 ТЕСТИРУЕМ GPT ПОИСК С QUERYENGINE");

  const testQueries = [
    "8512", // Чисто числовой
    "артикул 8512", // С контекстом
    "Таулетная бумага Миниджамбо", // Текстовый
    "Сколько товаров с артикулом?", // Аналитический
    "Покажи все бумажные изделия", // Категорийный
    "Какой товар самый дорогой?", // Аналитический сложный
    "несуществующий артикул 9999", // Несуществующий
  ];

  for (const query of testQueries) {
    await smartSearchWithGPT(query);

    // Пауза между запросами чтобы не превысить лимиты API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// Альтернатива: Простой QueryEngine без сложных стратегий
async function simpleGPTQuery(query: string) {
  console.log(`\n🔍 ПРОСТОЙ GPT ПОИСК: "${query}"`);

  const documents = await loadOptimizedDocuments(FILE_PATH);
  const index = await VectorStoreIndex.fromDocuments(documents);

  // Простой QueryEngine
  const queryEngine = index.asQueryEngine();

  const response = await queryEngine.query({
    query: query,
    stream: false,
  });

  console.log(`🤖 Ответ GPT:`);
  console.log(response.response);

  return response;
}

// Сравнение Vector Search vs GPT Search
async function compareSearchMethods() {
  console.log("⚖️ СРАВНЕНИЕ МЕТОДОВ ПОИСКА");

  const documents = await loadOptimizedDocuments(FILE_PATH);
  const index = await VectorStoreIndex.fromDocuments(documents);

  const testQuery = "8512";

  // 1. Векторный поиск (дешевый)
  console.log(`\n1. 🔍 ВЕКТОРНЫЙ ПОИСК: "${testQuery}"`);
  const retriever = index.asRetriever({ similarityTopK: 3 });
  const vectorResults = await retriever.retrieve(testQuery);

  console.log(`Найдено: ${vectorResults.length} результатов`);
  vectorResults.forEach((result, i) => {
    const articul = result.node.text?.match(/артикул:([^,]+)/)?.[1]?.trim();
    const name = result.node.text?.match(/наименование:([^,]+)/)?.[1]?.trim();
    console.log(
      `${i + 1}. Артикул: "${articul}" - ${name} (score: ${result.score.toFixed(4)})`,
    );
  });

  // 2. GPT поиск (дорогой но умный)
  console.log(`\n2. 🤖 GPT ПОИСК: "${testQuery}"`);
  const queryEngine = index.asQueryEngine();
  const gptResponse = await queryEngine.query({
    query: testQuery,
    stream: false,
  });

  console.log(`Ответ GPT: ${gptResponse.response}`);
}

// Запуск тестов
async function main() {
  console.log("🚀 ЗАПУСК GPT ПОИСКА С QUERYENGINE");

  // Выберите один из тестов:

  // 1. Простой тест одного запроса
  // await simpleGPTQuery("8512");

  // 2. Сравнение методов поиска
  // await compareSearchMethods();

  // 3. Полный тест всех запросов
  await testGPTQueries();
}

main().catch(console.error);
