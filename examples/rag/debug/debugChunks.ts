import { VectorStoreIndex } from "llamaindex";
async function debugChunks(index: VectorStoreIndex) {
  console.log("\n=== ДЕБАГ ЧАНКОВ ===");

  // Получаем все узлы (чанки)
  const docStore = index.storageContext.docStore;
  const allDocs = await docStore.docs();

  let chunkCount = 0;
  Object.entries(allDocs).forEach(([docId, doc]) => {
    if (doc.text) {
      const chunks = splitTextIntoChunks(doc.text, 512); // Примерная логика чанкинга
      console.log(`\n📄 Документ ${docId} -> ${chunks.length} чанков:`);

      chunks.forEach((chunk, chunkIndex) => {
        console.log(`  Чанк ${chunkIndex}: ${chunk.substring(0, 80)}...`);
        chunkCount++;
      });
    }
  });

  console.log(`\nВсего чанков: ${chunkCount}`);
}

function splitTextIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize));
  }
  return chunks;
}

export default debugChunks;
