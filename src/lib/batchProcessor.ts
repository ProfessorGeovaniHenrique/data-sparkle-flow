import { ParsedMusic } from './excelParser';
import { ProcessingContextType } from '../contexts/ProcessingContext';

export interface EnrichedMusicData {
  id?: string;
  titulo_original: string;
  artista_encontrado: string;
  compositor_encontrado: string;
  ano_lancamento: string;
  status_pesquisa: string;
  observacoes?: string;
}

type ProcessBatchFn = (batch: ParsedMusic[]) => Promise<EnrichedMusicData[]>;

export class BatchProcessor {
  private items: ParsedMusic[];
  private batchSize: number;
  private processBatch: ProcessBatchFn;
  private context: ProcessingContextType;
  private currentIndex: number = 0;
  private results: EnrichedMusicData[] = [];
  private isRunning: boolean = false;

  constructor(
    items: ParsedMusic[],
    batchSize: number = 50,
    processBatch: ProcessBatchFn,
    context: ProcessingContextType
  ) {
    this.items = items;
    this.batchSize = batchSize;
    this.processBatch = processBatch;
    this.context = context;
  }

  async start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.context.setStatus('enriching');
    this.results = [];
    this.currentIndex = 0;

    const totalBatches = Math.ceil(this.items.length / this.batchSize);

    try {
      const startTime = Date.now();
      let lastUpdateTime = startTime;
      let lastUpdateIndex = 0;

      while (this.currentIndex < this.items.length) {
        // Aguarda enquanto pausado
        while (this.context.status === 'paused') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Para se cancelado (status volta para idle)
        if (this.context.status === 'idle') break;

        const currentBatch = Math.floor(this.currentIndex / this.batchSize);
        const batch = this.items.slice(this.currentIndex, this.currentIndex + this.batchSize);

        try {
          const batchResults = await this.processBatch(batch);
          this.results.push(...batchResults);
          
          this.context.setResults([...this.results]);

        } catch (error) {
          this.context.addError({
            timestamp: new Date().toISOString(),
            message: `Falha no lote ${currentBatch + 1}/${totalBatches}`,
            details: error instanceof Error ? error.message : 'Erro desconhecido',
            failedItems: batch.map(m => m.titulo)
          });

          batch.forEach(music => {
            this.results.push({
              id: music.id,
              titulo_original: music.titulo,
              artista_encontrado: 'Não Identificado',
              compositor_encontrado: 'Não Identificado',
              ano_lancamento: '0000',
              observacoes: 'Erro no processamento do lote',
              status_pesquisa: 'Falha'
            });
          });
        }

        this.currentIndex += batch.length;
        
        const now = Date.now();
        const elapsedSinceLastUpdate = (now - lastUpdateTime) / 1000;
        
        if (elapsedSinceLastUpdate >= 1) {
          const itemsProcessedSinceLastUpdate = this.currentIndex - lastUpdateIndex;
          const speed = itemsProcessedSinceLastUpdate / elapsedSinceLastUpdate;
          const itemsRemaining = this.items.length - this.currentIndex;
          const eta = speed > 0 ? itemsRemaining / speed : 0;
          
          this.context.setProgress({
            current: this.currentIndex,
            total: this.items.length,
            speed,
            eta,
          });
          
          lastUpdateTime = now;
          lastUpdateIndex = this.currentIndex;
        } else {
          this.context.setProgress({
            current: this.currentIndex,
            total: this.items.length,
          });
        }
      }

      if (this.context.status !== 'idle') {
        this.context.setStatus('completed');
      }

    } catch (criticalError) {
      console.error('Critical error in batch processor:', criticalError);
      this.context.addError({
        timestamp: new Date().toISOString(),
        message: 'Erro crítico no processamento',
        details: criticalError instanceof Error ? criticalError.message : 'Erro desconhecido',
        failedItems: []
      });
      this.context.setStatus('idle');
    } finally {
      this.isRunning = false;
    }

    return this.results;
  }

  getResults(): EnrichedMusicData[] {
    return this.results;
  }

  getCurrentProgress() {
    return {
      processed: this.currentIndex,
      total: this.items.length,
      results: this.results
    };
  }
}
