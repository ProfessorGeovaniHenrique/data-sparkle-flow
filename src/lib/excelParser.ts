import * as XLSX from 'xlsx';

// Função para parsing usando Web Worker (não trava a UI)
export function parseExcelWithWorker(
  file: File, 
  onProgress?: (message: string, percentage: number) => void
): Promise<RawParseResult> {
  return new Promise((resolve, reject) => {
    // Criar worker
    const worker = new Worker(
      new URL('../workers/excelParser.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Ler arquivo como ArrayBuffer
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) {
        reject(new Error('Falha ao ler arquivo'));
        return;
      }

      // Enviar para worker
      worker.postMessage({
        type: 'PARSE_EXCEL',
        data: e.target.result,
        filename: file.name
      });
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
      worker.terminate();
    };

    // Receber mensagens do worker
    worker.onmessage = (e) => {
      const response = e.data;

      if (response.type === 'SUCCESS') {
        resolve(response.result);
        worker.terminate();
      } else if (response.type === 'ERROR') {
        reject(new Error(response.error));
        worker.terminate();
      } else if (response.type === 'PROGRESS' && onProgress) {
        onProgress(response.message, response.percentage);
      }
    };

    worker.onerror = (error) => {
      reject(new Error(`Worker error: ${error.message}`));
      worker.terminate();
    };

    // Iniciar leitura
    reader.readAsArrayBuffer(file);
  });
}

export interface ParsedMusic {
  titulo: string;
  artista?: string;
  compositor?: string;
  ano?: string;
  letra?: string;
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
  letraIndex: number;
  hasHeader: boolean;
}

function cleanTitle(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.replace(/^(nome da musica|t[ií]tulo|m[uú]sica)\s*[:=-]?\s*/i, '');
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/^\d+[\.\)\-\s]+/, '');
  return cleaned;
}

// Helper: retorna o valor mais longo (ou o primeiro se ambos vazios)
function chooseLonger(a?: string, b?: string): string | undefined {
  if (!a && !b) return undefined;
  if (!a) return b;
  if (!b) return a;
  return a.length >= b.length ? a : b;
}

// Consolida músicas duplicadas (mesmo título + artista)
function consolidateDuplicates(musics: ParsedMusic[]): ParsedMusic[] {
  // Cria um Map usando chave composta (titulo + artista, case-insensitive)
  const musicMap = new Map<string, ParsedMusic>();
  
  musics.forEach(music => {
    // Sanitizar artista para garantir que é string
    const artistaStr = typeof music.artista === 'object' 
      ? String((music.artista as any)?.value || '') 
      : (music.artista || '');
    
    const key = `${music.titulo.toLowerCase().trim()}|||${artistaStr.toLowerCase().trim()}`;
    
    if (!musicMap.has(key)) {
      // Primeira ocorrência: adiciona ao Map (garantindo artista como string)
      musicMap.set(key, { 
        ...music,
        artista: artistaStr || undefined
      });
    } else {
      // Duplicata encontrada: consolidar campos
      const existing = musicMap.get(key)!;
      
      // Regra: prioriza o valor mais longo/completo
      existing.compositor = chooseLonger(existing.compositor, music.compositor);
      existing.ano = chooseLonger(existing.ano, music.ano);
      existing.artista = chooseLonger(existing.artista, artistaStr);
      // Mantém o titulo, fonte e id originais
    }
  });
  
  return Array.from(musicMap.values());
}

/**
 * Limpa dados de scraper fundindo linhas consecutivas duplicadas
 * Resolve o caso específico onde uma linha tem metadados e a próxima tem metadados + letra
 */
export function cleanScraperData(
  data: ParsedMusic[], 
  logger?: (msg: string) => void
): ParsedMusic[] {
  const log = logger || (() => {});
  
  if (data.length === 0) return data;
  
  log(`Iniciando limpeza de scraper em ${data.length} linhas...`);
  
  // Normaliza string para comparação (remove acentos, lowercase, trim)
  const normalize = (str: string) => 
    str.toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  
  // Ordena por título + artista para agrupar duplicatas consecutivas
  const sorted = [...data].sort((a, b) => {
    const titleCompare = normalize(a.titulo).localeCompare(normalize(b.titulo));
    if (titleCompare !== 0) return titleCompare;
    return normalize(a.artista || '').localeCompare(normalize(b.artista || ''));
  });
  
  log(`Ordenação concluída. Analisando duplicatas...`);
  
  const cleaned: ParsedMusic[] = [];
  let mergedCount = 0;
  let i = 0;
  
  while (i < sorted.length) {
    const current = sorted[i];
    const next = sorted[i + 1];
    
    // Verifica se há um próximo item e se é uma duplicata
    if (next && 
        normalize(current.titulo) === normalize(next.titulo) &&
        normalize(current.artista || '') === normalize(next.artista || '')) {
      
      // Funde os dois itens, pegando o melhor de cada
      const merged: ParsedMusic = {
        id: current.id,
        titulo: current.titulo || next.titulo,
        artista: chooseLonger(current.artista, next.artista),
        compositor: chooseLonger(current.compositor, next.compositor),
        ano: chooseLonger(current.ano, next.ano),
        fonte: current.fonte,
      };
      
      cleaned.push(merged);
      mergedCount++;
      log(`✓ Mesclando duplicata: "${current.titulo}" - ${current.artista || 'Sem artista'}`);
      
      // Pula o próximo item pois já foi fundido
      i += 2;
    } else {
      // Não é duplicata, mantém o item
      cleaned.push(current);
      i++;
    }
  }
  
  log(`Limpeza concluída! ${mergedCount} duplicatas mescladas.`);
  log(`De ${data.length} linhas originais → ${cleaned.length} músicas únicas.`);
  
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
            else if (lowerCell.includes('letra') || lowerCell.includes('lyric')) columnIndices.letra = index;
          });

          if (columnIndices.musica !== undefined) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1 || columnIndices.musica === undefined) {
          // Não encontrou cabeçalho estruturado
          // Não alterar headerRowIndex aqui - deixar como -1 para acionar formato alternado
          columnIndices.musica = 0;
          console.warn("Cabeçalho não detectado. Tentando formato alternado ou coluna A.");
        }

        console.log('[Parser] Detecção de cabeçalho:', {
          headerRowIndex,
          columnIndices,
          detectouMultiplasColunas: Object.keys(columnIndices).length > 1
        });

        const extractedData: ParsedMusic[] = [];

        // Detecta se é formato alternado (sem cabeçalho estruturado)
        // Só usa formato alternado se NÃO encontrou cabeçalho E tem apenas 1 coluna
        const isAlternatingFormat = (
          headerRowIndex === -1 && 
          Object.keys(columnIndices).length <= 1
        );
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
          // FORMATO TABULAR COM FILL DOWN
          console.log('[Parser] Usando formato TABULAR com fill down');
          console.log('[Parser] Colunas detectadas:', columnIndices);
          let lastSeenArtista: string | undefined = undefined;
          let lastSeenCompositor: string | undefined = undefined;

          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            const rawTitle = row[columnIndices.musica];

            if (rawTitle && typeof rawTitle === 'string' && rawTitle.trim().length > 1) {
              // Lógica de Fill Down para Artista
              const rawArtista = columnIndices.artista !== undefined ? row[columnIndices.artista] : undefined;
              if (rawArtista && String(rawArtista).trim().length > 0) {
                lastSeenArtista = String(rawArtista).trim();
              }
              // Se célula vazia, mantém lastSeenArtista (não atualiza)

              // Lógica de Fill Down para Compositor
              const rawCompositor = columnIndices.compositor !== undefined ? row[columnIndices.compositor] : undefined;
              if (rawCompositor && String(rawCompositor).trim().length > 0) {
                lastSeenCompositor = String(rawCompositor).trim();
              }

              const rawLetra = columnIndices.letra !== undefined ? row[columnIndices.letra] : undefined;
              const letra = rawLetra && String(rawLetra).trim().length > 0 ? String(rawLetra).trim() : undefined;

              extractedData.push({
                id: `${file.name}-${i}`,
                titulo: cleanTitle(rawTitle),
                artista: lastSeenArtista, // Usa o último artista visto
                compositor: lastSeenCompositor, // Usa o último compositor visto
                ano: columnIndices.ano !== undefined ? row[columnIndices.ano] : undefined,
                letra: letra,
                fonte: file.name
              });
            }
          }

          // Log adicional para debugging
          console.log('[Parser] Fill Down aplicado. Último artista:', lastSeenArtista);
        }

        // Log de debug: Dados extraídos (ANTES da consolidação)
        console.log('[Parser] Dados extraídos:', extractedData.length, 'músicas');
        console.log('[Parser] Primeiras 3 músicas:', extractedData.slice(0, 3));

        // Consolidar duplicatas
        const consolidatedData = consolidateDuplicates(extractedData);
        console.log('[Parser] Após consolidação:', consolidatedData.length, 'músicas únicas');

        // Calcula confiança da detecção
        const detectionConfidence: 'high' | 'low' = 
          (headerRowIndex > -1 && columnIndices.musica !== undefined) ? 'high' : 'low';

        resolve({
          filename: file.name,
          totalRows: consolidatedData.length,
          extractedData: consolidatedData,
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

        let lastSeenArtista: string | undefined = undefined;
        let lastSeenCompositor: string | undefined = undefined;

        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i];
          // Garante que a linha tem dados na coluna de título
          const tituloRaw = row[map.tituloIndex];
          if (tituloRaw && String(tituloRaw).trim().length > 1) {
            // Lógica de Fill Down para Artista com sanitização
            const rawArtista = map.artistaIndex >= 0 ? row[map.artistaIndex] : undefined;
            let artistaValue: string | undefined = undefined;
            
            if (rawArtista !== null && rawArtista !== undefined) {
              // Se for objeto, extrair propriedade 'value'
              if (typeof rawArtista === 'object') {
                artistaValue = (rawArtista as any).value !== undefined 
                  ? String((rawArtista as any).value).trim() 
                  : undefined;
              } else {
                artistaValue = String(rawArtista).trim();
              }
              
              // Se resultou em string válida, atualizar lastSeenArtista
              if (artistaValue && artistaValue.length > 0 && artistaValue !== 'undefined') {
                lastSeenArtista = artistaValue;
              }
            }
            // Se célula vazia, mantém lastSeenArtista

            // Lógica de Fill Down para Compositor
            const rawCompositor = map.compositorIndex >= 0 ? row[map.compositorIndex] : undefined;
            if (rawCompositor && String(rawCompositor).trim().length > 0) {
              lastSeenCompositor = String(rawCompositor).trim();
            }

            const rawLetra = map.letraIndex >= 0 ? row[map.letraIndex] : undefined;
            const letra = rawLetra && String(rawLetra).trim().length > 0 ? String(rawLetra).trim() : undefined;

            extractedData.push({
              id: `${file.name}-${i}`,
              titulo: cleanTitle(String(tituloRaw)),
              artista: lastSeenArtista, // Usa o último artista visto
              compositor: lastSeenCompositor, // Usa o último compositor visto
              ano: map.anoIndex >= 0 && row[map.anoIndex]
                ? String(row[map.anoIndex])
                : undefined,
              letra: letra,
              fonte: file.name
            });
          }
        }

        // Log adicional para debugging
        console.log('[Parser] Fill Down (manual map) aplicado. Artista final:', lastSeenArtista);

        // Log de debug: Dados extraídos após mapeamento (ANTES da consolidação)
        console.log('[Parser] Dados extraídos após mapeamento:', extractedData.length, 'músicas');
        console.log('[Parser] Primeiras 3 músicas:', extractedData.slice(0, 3));

        // Consolidar duplicatas
        const consolidatedData = consolidateDuplicates(extractedData);
        console.log('[Parser] Após consolidação:', consolidatedData.length, 'músicas únicas');

        resolve({
          filename: file.name,
          totalRows: consolidatedData.length,
          extractedData: consolidatedData,
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
