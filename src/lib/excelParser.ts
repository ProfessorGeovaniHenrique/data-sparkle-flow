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
  detectionConfidence?: 'high' | 'low';
}

export interface RawParseResult {
  filename: string;
  rawRows: any[][];
  totalRows: number;
  detectionConfidence: 'high' | 'low';
}

export interface ColumnMap {
  tituloIndex: number;
  artistaIndex: number;
  compositorIndex: number;
  anoIndex: number;
  hasHeader: boolean;
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

        // Detecta se é formato alternado (sem cabeçalho estruturado)
        const isAlternatingFormat = headerRowIndex === -1 || headerRowIndex === 0;
        const startIndex = isAlternatingFormat ? 0 : headerRowIndex + 1;
        const dataColumnIndex = 0; // Primeira coluna

        if (isAlternatingFormat) {
          // FORMATO ALTERNADO: Linha 1 = Título, Linha 2 = Artista
          let pendingTitle: string | null = null;
          let pendingTitleRowIndex = -1;

          for (let i = startIndex; i < jsonData.length; i++) {
            const row = jsonData[i];
            const cellValue = row[dataColumnIndex];
            const cleanedValue = cleanTitle(String(cellValue || ''));

            if (!cleanedValue || cleanedValue.length < 2) {
              continue; // Pula linhas vazias
            }

            if (pendingTitle === null) {
              // Linha do título
              pendingTitle = cleanedValue;
              pendingTitleRowIndex = i;
            } else {
              // Linha do artista
              extractedData.push({
                id: `${file.name}-${pendingTitleRowIndex}`,
                titulo: pendingTitle,
                artista: cleanedValue,
                fonte: file.name
              });
              pendingTitle = null;
              pendingTitleRowIndex = -1;
            }
          }

          // Se sobrou título sem artista, adiciona mesmo assim
          if (pendingTitle !== null) {
            extractedData.push({
              id: `${file.name}-${pendingTitleRowIndex}`,
              titulo: pendingTitle,
              artista: 'Não Identificado',
              fonte: file.name
            });
          }

        } else {
          // FORMATO TABULAR ORIGINAL (mantém lógica existente)
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
        }

        // Calcula confiança da detecção
        const detectionConfidence: 'high' | 'low' = 
          (headerRowIndex > -1 && columnIndices.musica !== undefined) ? 'high' : 'low';

        resolve({
          filename: file.name,
          totalRows: extractedData.length,
          extractedData: extractedData,
          columnsDetected: {
            musica: true,
            artista: isAlternatingFormat ? true : (columnIndices.artista !== undefined),
            compositor: isAlternatingFormat ? false : (columnIndices.compositor !== undefined),
            ano: isAlternatingFormat ? false : (columnIndices.ano !== undefined)
          },
          detectionConfidence
        });

      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

// Nova função para extrair dados brutos sem tentar adivinhar
export async function parseExcelRaw(file: File): Promise<RawParseResult> {
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

        // Tenta detectar se há cabeçalho conhecido
        let hasKnownHeader = false;
        if (jsonData.length > 0) {
          const firstRow = jsonData[0];
          firstRow.forEach((cell: any) => {
            if (typeof cell === 'string') {
              const lowerCell = cell.toLowerCase().trim();
              if (lowerCell.includes('música') || lowerCell.includes('titulo') || 
                  lowerCell.includes('artista') || lowerCell.includes('compositor')) {
                hasKnownHeader = true;
              }
            }
          });
        }

        resolve({
          filename: file.name,
          rawRows: jsonData.slice(0, 20), // Retorna apenas as primeiras 20 linhas para preview
          totalRows: jsonData.length,
          detectionConfidence: hasKnownHeader ? 'high' : 'low'
        });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

// Nova função que aplica o mapa do usuário aos dados
export async function extractDataFromMap(file: File, map: ColumnMap): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        const extractedData: ParsedMusic[] = [];
        const startIndex = map.hasHeader ? 1 : 0;

        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i];
          // Garante que a linha tem dados na coluna de título
          const tituloRaw = row[map.tituloIndex];
          if (tituloRaw && String(tituloRaw).trim().length > 1) {
            extractedData.push({
              id: `${file.name}-${i}`,
              titulo: cleanTitle(String(tituloRaw)),
              artista: map.artistaIndex >= 0 && row[map.artistaIndex] 
                ? String(row[map.artistaIndex]) 
                : undefined,
              compositor: map.compositorIndex >= 0 && row[map.compositorIndex]
                ? String(row[map.compositorIndex])
                : undefined,
              ano: map.anoIndex >= 0 && row[map.anoIndex]
                ? String(row[map.anoIndex])
                : undefined,
              fonte: file.name
            });
          }
        }

        resolve({
          filename: file.name,
          totalRows: extractedData.length,
          extractedData: extractedData,
          columnsDetected: {
            musica: true,
            artista: map.artistaIndex >= 0,
            compositor: map.compositorIndex >= 0,
            ano: map.anoIndex >= 0
          },
          detectionConfidence: 'high' // Manual mapping sempre tem alta confiança
        });

      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}
