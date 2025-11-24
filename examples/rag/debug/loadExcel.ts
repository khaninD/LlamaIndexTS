import { ExcelReader } from "@llamaindex/excel";
import { Document } from "llamaindex";
export async function loadExcelWithoutDuplicates(
  filePath: string,
): Promise<Document[]> {
  const reader = new ExcelReader({ sheetSpecifier: 0, concatRows: false });
  const rawDocs = await reader.loadData(filePath);

  // Создаем новые документы с чистыми ID
  const cleanDocs = rawDocs.map((rawDoc, index) => {
    const text = rawDoc.text || "";
    const articulMatch = text.match(/артикул:(\d+)/);

    return new Document({
      text: text,
      id_: articulMatch ? `articul_${articulMatch[1]}` : `row_${index + 21}`,
      metadata: {
        ...rawDoc.metadata,
        articul: articulMatch?.[1],
        source: "excel_clean",
      },
    });
  });

  console.log(`✅ Создано ${cleanDocs.length} документов без дублей`);
  return cleanDocs;
}

export async function loadExcelWithArticulOptimization(
  filePath: string,
): Promise<Document[]> {
  const reader = new ExcelReader({ sheetSpecifier: 0, concatRows: false });
  const rawDocs = await reader.loadData(filePath);

  const optimizedDocs = rawDocs.map((rawDoc) => {
    const text = rawDoc.text || "";
    const articulMatch = text.match(/артикул:([^,]+)/);
    const nameMatch = text.match(/наименование:([^,]+)/);

    if (articulMatch && nameMatch) {
      const articul = articulMatch[1].trim();
      const name = nameMatch[1].trim();

      // КРИТИЧЕСКИ ВАЖНО: Добавляем контекст для числовых артикулов
      const optimizedText =
        articul !== "-"
          ? `
        ТОВАР: ${name}
        АРТИКУЛ: ${articul}
        КОД ТОВАРА: ${articul}
        НОМЕР: ${articul}
        ID: ${articul}
        
        ДЛЯ ПОИСКА АРТИКУЛА:
        - артикул ${articul}
        - код ${articul}
        - номер ${articul}
        - товар ${articul}
        - найти ${articul}
        - поиск ${articul}
        - ${articul} ${name}
        
        ПОЛНЫЕ ДАННЫЕ:
        ${text}
      `
          : `
        ТОВАР: ${name}
        АРТИКУЛ: не указан
        БЕЗ АРТИКУЛА: ${name}
        
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
          has_articul: articul !== "-",
        },
      });
    }

    return rawDoc;
  });

  console.log(`✅ Создано ${optimizedDocs.length} оптимизированных документов`);
  return optimizedDocs;
}
