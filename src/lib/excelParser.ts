import * as XLSX from 'xlsx';

/**
 * Normaliza valor de célula para string ou null
 * Trata todos os casos edge: objetos, números, booleanos, strings vazias, whitespace
 */
function normalizeCellValue(cellValue: any): string | null {
  // Casos claramente vazios
  if (cellValue === null || cellValue === undefined) {
    return null;
  }
  
  // Objetos (células mescladas podem retornar objetos)
  if (typeof cellValue === 'object') {
    const value = (cellValue as any)?.value;
    if (value === null || value === undefined) return null;
    cellValue = value;
  }
  
  // Converter para string e normalizar
  const str = String(cellValue).trim();
  
  // String vazia ou apenas whitespace
  if (str === '' || str === 'undefined' || str === 'null') {
    return null;
  }
  
  return str;
}

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

    // Timeout de 30 segundos para prevenir travamento
    const timeoutId = setTimeout(() => {
      worker.terminate();
      reject(new Error('Timeout: O processamento do arquivo excedeu 30 segundos. Tente um arquivo menor ou divida-o em partes.'));
    }, 30000);

    // Ler arquivo como ArrayBuffer
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) {
        clearTimeout(timeoutId);
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
      clearTimeout(timeoutId);
      reject(new Error('Erro ao ler arquivo'));
      worker.terminate();
    };

    // Receber mensagens do worker
    worker.onmessage = (e) => {
      const response = e.data;

      if (response.type === 'SUCCESS') {
        clearTimeout(timeoutId);
        resolve(response.result);
        worker.terminate();
      } else if (response.type === 'ERROR') {
        clearTimeout(timeoutId);
        reject(new Error(response.error));
        worker.terminate();
      } else if (response.type === 'PROGRESS' && onProgress) {
        onProgress(response.message, response.percentage);
      }
    };

    worker.onerror = (error) => {
      clearTimeout(timeoutId);
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
  console.log(`[Consolidação] Iniciando com ${musics.length} itens...`);
  
  const uniqueMap = new Map<string, ParsedMusic>();

  musics.forEach((music, index) => {
    // Normalizar título e artista para comparação
    const normalizedTitle = (music.titulo || '').toLowerCase().trim();
    const normalizedArtist = (music.artista || '').toLowerCase().trim();
    
    // Log para debug
    if (index < 5) {
      console.log(`[Consolidação] Item ${index}: "${normalizedTitle}" - "${normalizedArtist}"`);
    }
    
    // Chave composta OBRIGATÓRIA: TÍTULO + ARTISTA
    // Se o título for diferente, a chave SERÁ diferente, impedindo a fusão indevida
    const key = `${normalizedTitle}|||${normalizedArtist}`;

    if (uniqueMap.has(key)) {
      // Duplicata encontrada: merge seguro
      const existing = uniqueMap.get(key)!;
      console.log(`[Consolidação] Duplicata encontrada: "${music.titulo}" - "${music.artista}"`);
      
      // Preservar o que tiver mais dados (letra, compositor, etc)
      const merged: ParsedMusic = {
        ...existing,
        compositor: existing.compositor || music.compositor,
        ano: existing.ano || music.ano,
        letra: existing.letra || music.letra,
      };
      
      uniqueMap.set(key, merged);
    } else {
      // Primeira ocorrência
      uniqueMap.set(key, music);
    }
  });

  const result = Array.from(uniqueMap.values());
  console.log(`[Consolidação] Finalizado. Resultado: ${result.length} músicas únicas.`);
  return result;
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

        // Fase 1: Varredura inteligente de cabeçalhos (primeiras 20 linhas)
        for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
          const row = jsonData[i];
          row.forEach((cell: any, index: number) => {
            if (typeof cell !== 'string') return;
            const lowerCell = cell.toLowerCase().trim();

            // Detecção expandida de coluna de música/título
            if (lowerCell.includes('música') || lowerCell.includes('musica') || 
                lowerCell.includes('titulo') || lowerCell.includes('título') ||
                lowerCell === 'nome' || lowerCell.includes('faixa') || 
                lowerCell.includes('track') || lowerCell.includes('song')) {
              columnIndices.musica = index;
            }
            // Detecção expandida de coluna de artista
            else if (lowerCell.includes('artista') || lowerCell.includes('intérprete') ||
                     lowerCell.includes('interprete') || lowerCell.includes('cantor') ||
                     lowerCell.includes('autor') || lowerCell.includes('banda') ||
                     lowerCell.includes('artist')) {
              columnIndices.artista = index;
            }
            // Compositor
            else if (lowerCell.includes('compositor') || lowerCell.includes('composer')) {
              columnIndices.compositor = index;
            }
            // Ano
            else if (lowerCell.includes('ano') || lowerCell.includes('lançamento') || 
                     lowerCell.includes('lancamento') || lowerCell.includes('year')) {
              columnIndices.ano = index;
            }
            // Letra
            else if (lowerCell.includes('letra') || lowerCell.includes('lyric')) {
              columnIndices.letra = index;
            }
          });

          if (columnIndices.musica !== undefined) {
            headerRowIndex = i;
            break;
          }
        }

        // Fase 2: Fallback Posicional (CRÍTICO)
        // Se não detectou cabeçalho, assume estrutura padrão: Coluna A = Artista, Coluna B = Música
        if (headerRowIndex === -1 || columnIndices.musica === undefined) {
          console.warn('[Parser] Cabeçalhos não identificados. Aplicando fallback posicional padrão.');
          
          // Verifica se temos pelo menos 2 colunas com dados
          const hasMultipleColumns = jsonData.length > 0 && jsonData[0].length >= 2;
          
          if (hasMultipleColumns) {
            // Padrão brasileiro comum: Coluna A = Artista, Coluna B = Música
            if (columnIndices.artista === undefined) columnIndices.artista = 0;
            if (columnIndices.musica === undefined) columnIndices.musica = 1;
            
            console.log('[Parser] Fallback aplicado: Artista=Coluna A (0), Música=Coluna B (1)');
            headerRowIndex = 0; // Assumir que primeira linha é dados, não cabeçalho
          } else {
            // Apenas uma coluna - formato alternado (título/artista em linhas consecutivas)
            columnIndices.musica = 0;
            console.log('[Parser] Detectado formato de coluna única (alternado)');
          }
        }

        console.log('[Parser] Detecção de cabeçalho:', {
          headerRowIndex,
          columnIndices,
          detectouMultiplasColunas: Object.keys(columnIndices).length > 1,
          musicaColuna: columnIndices.musica,
          artistaColuna: columnIndices.artista
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
          // FORMATO TABULAR COM FILL DOWN - Implementação Robusta
          console.log('[Parser] Iniciando extração robusta (formato tabular)...');
          console.log('[Parser] Colunas detectadas:', columnIndices);
          
          // Estado persistente do último artista/compositor visto
          let lastValidArtist: string = 'Desconhecido';
          let lastValidComposer: string = '';
          let fillDownCount = 0; // Contador de Fill Down

          // Iterar linha a linha, sem filtros prévios
          for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // Proteção contra linhas undefined
            if (!row || row.length === 0) continue;

            // 1. Extrair valores brutos
            const rawArtist = columnIndices.artista !== undefined ? row[columnIndices.artista] : undefined;
            const rawTitle = row[columnIndices.musica];
            const rawComposer = columnIndices.compositor !== undefined ? row[columnIndices.compositor] : undefined;
            const rawYear = columnIndices.ano !== undefined ? row[columnIndices.ano] : undefined;
            const rawLyrics = columnIndices.letra !== undefined ? row[columnIndices.letra] : undefined;

            // 2. Normalizar Título
            const titleStr = String(rawTitle || '').trim();
            
            // SE NÃO TEM TÍTULO, PULA. (Única condição de descarte)
            if (!titleStr) {
              continue;
            }

            // 3. Lógica de Artista (Fill Down)
            const artistStr = String(rawArtist || '').trim();
            let effectiveArtist = '';

            if (artistStr.length > 0) {
              // Temos um artista novo nesta linha
              effectiveArtist = artistStr;
              lastValidArtist = artistStr; // Atualiza o estado
            } else {
              // Célula vazia -> Herda o anterior
              effectiveArtist = lastValidArtist;
              fillDownCount++; // Incrementa contador
            }

            // 4. Lógica de Compositor (Fill Down)
            const composerStr = String(rawComposer || '').trim();
            let effectiveComposer = '';

            if (composerStr.length > 0) {
              effectiveComposer = composerStr;
              lastValidComposer = composerStr;
            } else {
              effectiveComposer = lastValidComposer;
            }

            // 5. Adicionar ao resultado
            extractedData.push({
              id: `${file.name}-${i}`,
              titulo: cleanTitle(titleStr),
              artista: effectiveArtist,
              compositor: effectiveComposer || undefined,
              ano: String(rawYear || '').trim() || undefined,
              letra: String(rawLyrics || '').trim() || undefined,
              fonte: file.name
            });
          }

          // Log de Fill Down
          if (fillDownCount > 0) {
            console.log(`[Parser] Fill Down aplicado ${fillDownCount} vezes. Último artista: '${lastValidArtist}'`);
          } else {
            console.log('[Parser] Fill Down não foi necessário (artista presente em todas as linhas)');
          }
        }

        // Log de debug: Dados extraídos
        console.log('[Parser] Dados extraídos:', extractedData.length, 'músicas');
        console.log('[Parser] Primeiras 3 músicas:', extractedData.slice(0, 3));

        // Validar diversidade de títulos (detecta parsing incorreto)
        const uniqueTitles = new Set(extractedData.map(m => m.titulo.toLowerCase()));
        const diversityRatio = uniqueTitles.size / extractedData.length;

        if (diversityRatio < 0.5) {
          console.warn(`[Parser] ⚠️ ALERTA: Apenas ${uniqueTitles.size} títulos únicos de ${extractedData.length} linhas (${(diversityRatio * 100).toFixed(0)}%)`);
          console.warn('[Parser] Títulos detectados:', Array.from(uniqueTitles).slice(0, 5));
          console.warn('[Parser] Possível erro de mapeamento de colunas! Verifique se as colunas foram detectadas corretamente.');
        } else {
          console.log(`[Parser] ✓ Diversidade de títulos: ${(diversityRatio * 100).toFixed(0)}% (${uniqueTitles.size}/${extractedData.length})`);
        }

        // Retornar dados SEM consolidação (será feito no FileUpload se necessário)
        console.log('[Parser] Retornando dados extraídos sem consolidação (deduplicação será feita no FileUpload)');

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

        console.log('[Parser] Iniciando extração robusta (mapeamento manual)...');
        const extractedData: ParsedMusic[] = [];
        const startIndex = map.hasHeader ? 1 : 0;

        // Estado persistente do último artista/compositor visto
        let lastValidArtist: string = 'Desconhecido';
        let lastValidComposer: string = '';

        // Iterar linha a linha, sem filtros prévios
        for (let i = startIndex; i < jsonData.length; i++) {
          const row = jsonData[i];
          
          // Proteção contra linhas undefined
          if (!row || row.length === 0) continue;

          // 1. Extrair valores brutos
          const rawArtist = map.artistaIndex >= 0 ? row[map.artistaIndex] : undefined;
          const rawTitle = row[map.tituloIndex];
          const rawComposer = map.compositorIndex >= 0 ? row[map.compositorIndex] : undefined;
          const rawYear = map.anoIndex >= 0 ? row[map.anoIndex] : undefined;
          const rawLyrics = map.letraIndex >= 0 ? row[map.letraIndex] : undefined;

          // 2. Normalizar Título
          const titleStr = String(rawTitle || '').trim();
          
          // SE NÃO TEM TÍTULO, PULA. (Única condição de descarte)
          if (!titleStr) {
            continue;
          }

          // 3. Lógica de Artista (Fill Down)
          const artistStr = String(rawArtist || '').trim();
          let effectiveArtist = '';

          if (artistStr.length > 0) {
            // Temos um artista novo nesta linha
            effectiveArtist = artistStr;
            lastValidArtist = artistStr; // Atualiza o estado
          } else {
            // Célula vazia -> Herda o anterior
            effectiveArtist = lastValidArtist;
            console.log(`[Parser] Linha ${i}: Herdando artista '${effectiveArtist}'`);
          }

          // 4. Lógica de Compositor (Fill Down)
          const composerStr = String(rawComposer || '').trim();
          let effectiveComposer = '';

          if (composerStr.length > 0) {
            effectiveComposer = composerStr;
            lastValidComposer = composerStr;
          } else {
            effectiveComposer = lastValidComposer;
          }

          // 5. Adicionar ao resultado
          extractedData.push({
            id: `${file.name}-${i}`,
            titulo: cleanTitle(titleStr),
            artista: effectiveArtist,
            compositor: effectiveComposer || undefined,
            ano: String(rawYear || '').trim() || undefined,
            letra: String(rawLyrics || '').trim() || undefined,
            fonte: file.name
          });
        }

        console.log('[Parser] Fill Down (manual map) aplicado. Último artista:', lastValidArtist);

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
