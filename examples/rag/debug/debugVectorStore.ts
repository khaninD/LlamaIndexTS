import { VectorStoreIndex } from "llamaindex";
async function debugVectorStore(index: VectorStoreIndex) {
  console.log("=== ДЕБАГ ВЕКТОРНОЙ БАЗЫ ===");

  // Получаем storage context
  const storageContext = index.storageContext;

  // Смотрим документы
  const docStore = storageContext.docStore;
  const allDocs = await docStore.docs();
  console.log(`📄 Всего документов: ${Object.keys(allDocs).length}`);

  Object.entries(allDocs).forEach(([docId, doc]) => {
    console.log(`\n--- Документ ${docId} ---`);
    console.log("Текст:", doc.text?.substring(0, 200) + "...");
    console.log("Метаданные:", doc.metadata);
  });

  // Смотрим векторные хранилища - ОБРАТИТЕ ВНИМАНИЕ: vectorStores (множественное число)
  const vectorStores = storageContext.vectorStores;
  if (vectorStores) {
    console.log(`\n🔢 Векторные хранилища:`, Object.keys(vectorStores));

    // Дебажим каждое векторное хранилище
    for (const [storeKey, vectorStore] of Object.entries(vectorStores)) {
      console.log(`\n--- Векторное хранилище: ${storeKey} ---`);
      console.log("Тип:", vectorStore.constructor.name);
      console.log("--- Примеры документов ---");
      // Для SimpleVectorStore смотрим данные
      if (vectorStore.data) {
        console.log(
          `Количество векторов: ${Object.keys(vectorStore.data.embeddingDict || {}).length}`,
        );

        // Покажем несколько примеров векторов
        const embeddingDict = vectorStore.data.embeddingDict || {};
        const firstKeys = Object.keys(embeddingDict).slice(0, 3);
        console.log("Примеры ID векторов:", firstKeys);

        firstKeys.forEach((key, index) => {
          const embedding = embeddingDict[key];
          // if (index === 0) {
          //   console.log("Пример полного вектора для первого ключа:", embedding);
          // }
          console.log(
            `Вектор ${key}: [${embedding.slice(0, 5).join(", ")}...] (размер: ${embedding.length})`,
          );
        });
      }
    }
  } else {
    console.log("❌ vectorStores не доступен");
  }
}

export default debugVectorStore;
