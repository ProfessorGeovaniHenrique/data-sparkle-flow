import * as XLSX from 'xlsx';

// Tipos para a comunicação do worker
interface ParseExcelMessage {
  type: 'PARSE_EXCEL';
  data: ArrayBuffer;
  filename: string;
}

interface ParseExcelSuccessResponse {
  type: 'SUCCESS';
  result: {
    filename: string;
    rawRows: any[][];
    totalRows: number;
    detectionConfidence: 'high' | 'low';
  };
}

interface ParseExcelErrorResponse {
  type: 'ERROR';
  error: string;
}

interface ProgressResponse {
  type: 'PROGRESS';
  message: string;
  percentage: number;
}

type WorkerMessage = ParseExcelMessage;
type WorkerResponse = ParseExcelSuccessResponse | ParseExcelErrorResponse | ProgressResponse;

// Handler de mensagens do worker
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, data, filename } = e.data;

  if (type === 'PARSE_EXCEL') {
    try {
      console.log('[Worker] Iniciando parsing de', filename);
      postProgress('Lendo arquivo...', 10);

      // Ler workbook usando XLSX
      const workbook = XLSX.read(data, { type: 'array' });
      postProgress('Arquivo lido com sucesso', 30);

      // Pegar a primeira sheet
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('O arquivo não contém nenhuma planilha');
      }

      postProgress(`Processando planilha: ${firstSheetName}`, 50);
      const worksheet = workbook.Sheets[firstSheetName];

      // Converter para JSON (array de arrays)
      const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        defval: ''
      });

      postProgress('Convertendo dados...', 70);

      // Filtrar linhas vazias
      const rawRows = jsonData.filter(row => {
        // Uma linha é considerada válida se tiver pelo menos um valor não-vazio
        return row.some(cell => cell && String(cell).trim() !== '');
      });

      postProgress('Finalizando...', 90);

      // Detectar confiança baseado em padrões de cabeçalho
      let detectionConfidence: 'high' | 'low' = 'low';
      if (rawRows.length > 0) {
        const firstRow = rawRows[0].map((cell: any) => String(cell).toLowerCase());
        const hasExpectedHeaders = 
          firstRow.some(h => h.includes('musica') || h.includes('titulo') || h.includes('música') || h.includes('título')) &&
          firstRow.some(h => h.includes('artista') || h.includes('autor'));
        
        if (hasExpectedHeaders) {
          detectionConfidence = 'high';
        }
      }

      console.log('[Worker] Parsing concluído:', rawRows.length, 'linhas');
      postProgress('Concluído!', 100);

      // Enviar resultado de sucesso
      const response: ParseExcelSuccessResponse = {
        type: 'SUCCESS',
        result: {
          filename,
          rawRows,
          totalRows: rawRows.length,
          detectionConfidence
        }
      };

      self.postMessage(response);

    } catch (error) {
      console.error('[Worker] Erro no parsing:', error);
      
      const response: ParseExcelErrorResponse = {
        type: 'ERROR',
        error: error instanceof Error ? error.message : 'Erro desconhecido ao processar arquivo'
      };

      self.postMessage(response);
    }
  }
};

// Helper para enviar progresso
function postProgress(message: string, percentage: number) {
  const response: ProgressResponse = {
    type: 'PROGRESS',
    message,
    percentage
  };
  self.postMessage(response);
}

// Informar que o worker está pronto
console.log('[Worker] Excel Parser Worker inicializado');
