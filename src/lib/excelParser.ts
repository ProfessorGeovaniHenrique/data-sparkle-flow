import * as XLSX from 'xlsx';

export interface ParsedMusic {
  titulo: string;
  artista?: string;
  compositor?: string;
  ano?: string;
  fonte: string;
  id: string;
}

export interface ParseResult {
  filename: string;
  totalRows: number;
  extractedData: ParsedMusic[];
  columnsDetected: {
    musica: boolean;
    artista: boolean;
    compositor: boolean;
    ano: boolean;
  };
}

function cleanTitle(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.replace(/^(nome da musica|t[ií]tulo|m[uú]sica)\s*[:=-]?\s*/i, '');
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/^\d+[\.\)\-\s]+/, '');
  return cleaned;
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          throw new Error("O arquivo parece estar vazio.");
        }

        let headerRowIndex = -1;
        const columnIndices: any = {};

        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i];
          row.forEach((cell: any, index: number) => {
            if (typeof cell !== 'string') return;
            const lowerCell = cell.toLowerCase().trim();

            if (lowerCell.includes('música') || lowerCell.includes('titulo') || lowerCell === 'nome') columnIndices.musica = index;
            else if (lowerCell.includes('artista') || lowerCell.includes('intérprete')) columnIndices.artista = index;
            else if (lowerCell.includes('compositor') || lowerCell.includes('autor')) columnIndices.compositor = index;
            else if (lowerCell.includes('ano') || lowerCell.includes('lançamento')) columnIndices.ano = index;
          });

          if (columnIndices.musica !== undefined) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1 || columnIndices.musica === undefined) {
          headerRowIndex = 0;
          columnIndices.musica = 0;
          console.warn("Cabeçalho não detectado. Assumindo coluna A como títulos.");
        }

        const extractedData: ParsedMusic[] = [];
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rawTitle = row[columnIndices.musica];

          if (rawTitle && typeof rawTitle === 'string' && rawTitle.trim().length > 1) {
            extractedData.push({
              id: `${file.name}-${i}`,
              titulo: cleanTitle(rawTitle),
              artista: columnIndices.artista !== undefined ? row[columnIndices.artista] : undefined,
              compositor: columnIndices.compositor !== undefined ? row[columnIndices.compositor] : undefined,
              ano: columnIndices.ano !== undefined ? row[columnIndices.ano] : undefined,
              fonte: file.name
            });
          }
        }

        resolve({
          filename: file.name,
          totalRows: extractedData.length,
          extractedData: extractedData,
          columnsDetected: {
            musica: columnIndices.musica !== undefined,
            artista: columnIndices.artista !== undefined,
            compositor: columnIndices.compositor !== undefined,
            ano: columnIndices.ano !== undefined
          }
        });

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
