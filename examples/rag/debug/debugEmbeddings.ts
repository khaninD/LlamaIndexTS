import { Settings, VectorStoreIndex } from "llamaindex";

async function debugEmbeddings(index: VectorStoreIndex, query: string) {
  console.log(`\n=== ДЕБАГ ЭМБЕДДИНГОВ: "${query}" ===`);

  // Создаем эмбеддинг для запроса
  const queryEmbedding = await Settings.embedModel.getTextEmbedding(query);
  console.log(
    `Эмбеддинг запроса (первые 5 значений): [${queryEmbedding.slice(0, 5).join(", ")}...]`,
  );
  console.log(`Размерность: ${queryEmbedding.length}`);

  const retriever = index.asRetriever({ similarityTopK: 3 });
  const nodes = await retriever.retrieve(query);

  nodes.forEach((node, index) => {
    console.log(`\n📊 Результат ${index + 1}:`);
    console.log(`Сходство: ${node.score}`);
    console.log(`Текст: ${node.node.text?.substring(0, 100)}...`);
  });
}

export default debugEmbeddings;
