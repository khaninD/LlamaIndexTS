async function debugSearch(index: VectorStoreIndex, query: string) {
  console.log(`\n=== ДЕБАГ ПОИСКА: "${query}" ===`);

  const retriever = index.asRetriever({ similarityTopK: 5 });
  const nodes = await retriever.retrieve(query);

  console.log(`Найдено узлов: ${nodes.length}`);

  nodes.forEach((node, index) => {
    if (index > 0) return;
    console.log(
      `\n--- Результат ${index + 1} (score: ${node.score.toFixed(4)}) ---`,
    );
    console.log("Текст:", node.node.text);
    console.log("ID узла:", node.node.id_);
    console.log("Метаданные:", node.node.metadata);
    console.log("Тип:", node.node.type);
  });

  return nodes;
}

export default debugSearch;
