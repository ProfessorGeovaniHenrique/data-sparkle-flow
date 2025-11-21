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
  approval_status?: 'pending' | 'approved';
  enriched_by_web?: boolean; // Indica se foi usado fallback de pesquisa web
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
  private readonly MAX_RETRIES = 3;
  private readonly INITIAL_RETRY_DELAY_MS = 2000;
  private readonly CONCURRENCY = 3;

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
    
    // Log de debug: BatchProcessor criado
    console.log('[BatchProcessor] Criado com', items.length, 'items');
    console.log('[BatchProcessor] Primeiros 3 items:', items.slice(0, 3));
  }

  private async processWithRetry(batch: ParsedMusic[], batchNumber: number): Promise<EnrichedMusicData[]> {
    console.log('[BatchProcessor] processWithRetry - Batch', batchNumber, 'com', batch.length, 'items');
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log('[BatchProcessor] Tentativa', attempt, '/', this.MAX_RETRIES, 'para batch', batchNumber);
        
        if (attempt > 1) {
          this.context.addError({
            timestamp: new Date().toISOString(),
            message: `Tentativa ${attempt}/${this.MAX_RETRIES} para lote ${batchNumber}`,
            details: `Reconectando após falha: ${lastError?.message}`,
            failedItems: []
          });
        }
        
        console.log('[BatchProcessor] Chamando processBatch para batch', batchNumber);
        const results = await this.processBatch(batch);
        console.log('[BatchProcessor] processBatch retornou', results.length, 'resultados para batch', batchNumber);
        return results;
        
      } catch (error) {
        console.error('[BatchProcessor] ERRO na tentativa', attempt, 'do batch', batchNumber, ':', error);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.MAX_RETRIES) {
          const delay = this.INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          console.warn(`[BatchProcessor] Tentativa ${attempt} falhou. Aguardando ${delay}ms antes de retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error('[BatchProcessor] Todas as tentativas falharam para batch', batchNumber);
    throw new Error(`Falha após ${this.MAX_RETRIES} tentativas: ${lastError?.message}`);
  }

  async start() {
    console.log('[BatchProcessor] start() chamado');
    console.log('[BatchProcessor] isRunning:', this.isRunning);
    console.log('[BatchProcessor] context.status:', this.context.status);
    
    if (this.isRunning) {
      console.warn('[BatchProcessor] Já está rodando, abortando');
      return;
    }
    
    this.isRunning = true;
    this.context.setStatus('enriching');
    console.log('[BatchProcessor] Status definido para enriching');
    
    this.results = [];
    this.currentIndex = 0;

    const totalBatches = Math.ceil(this.items.length / this.batchSize);
    console.log('[BatchProcessor] Total de batches:', totalBatches);
    console.log('[BatchProcessor] Batch size:', this.batchSize);

    try {
      const startTime = Date.now();
      let lastUpdateTime = startTime;
      let lastUpdateIndex = 0;

      while (this.currentIndex < this.items.length) {
        console.log('[BatchProcessor] Loop - currentIndex:', this.currentIndex, '/ total:', this.items.length);
        console.log('[BatchProcessor] Status atual:', this.context.status);
        
        // Aguarda enquanto pausado
        while (this.context.status === 'paused') {
          console.log('[BatchProcessor] PAUSADO - aguardando...');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Para se cancelado (status volta para idle)
        if (this.context.status === 'idle') {
          console.log('[BatchProcessor] Status IDLE detectado - parando');
          break;
        }

        console.log('[BatchProcessor] Criando', this.CONCURRENCY, 'batches em paralelo');

        // Process up to CONCURRENCY batches in parallel
        const batchPromises: Promise<void>[] = [];
        
        for (let i = 0; i < this.CONCURRENCY && this.currentIndex < this.items.length; i++) {
          const batchStart = this.currentIndex;
          const batch = this.items.slice(batchStart, batchStart + this.batchSize);
          const batchNumber = Math.floor(batchStart / this.batchSize) + 1;
          
          console.log('[BatchProcessor] Batch', batchNumber, '- Itens:', batch.length, '(índices', batchStart, '-', batchStart + batch.length - 1, ')');
          
          this.currentIndex += batch.length;
          
          const batchPromise = this.processWithRetry(batch, batchNumber)
            .then(batchResults => {
              console.log('[BatchProcessor] Batch', batchNumber, 'concluído - Resultados:', batchResults.length);
              
              // Mark as pending by default (inbox)
              const enrichedResults = batchResults.map(r => ({
                ...r,
                approval_status: 'pending' as const
              }));
              
              this.results.push(...enrichedResults);
              this.context.setResults([...this.results]);
            })
            .catch(batchError => {
              console.error('[BatchProcessor] ERRO no batch', batchNumber, ':', batchError);
              
              this.context.addError({
                timestamp: new Date().toISOString(),
                message: `Falha no lote ${batchNumber}/${totalBatches}`,
                details: batchError instanceof Error ? batchError.message : 'Erro desconhecido',
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
                  status_pesquisa: 'Falha',
                  approval_status: 'pending' as const
                });
              });
              
              this.context.setResults([...this.results]);
            });
          
          batchPromises.push(batchPromise);
        }
        
        console.log('[BatchProcessor] Aguardando', batchPromises.length, 'batches em paralelo');
        
        // Wait for all parallel batches to complete
        await Promise.all(batchPromises);
        
        console.log('[BatchProcessor] Batches concluídos');
        
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

      console.log('[BatchProcessor] Loop concluído - Processamento finalizado');
      
      if (this.context.status !== 'idle') {
        this.context.setStatus('completed');
        console.log('[BatchProcessor] Status definido para completed');
      }

    } catch (criticalError) {
      console.error('[BatchProcessor] ERRO CRÍTICO:', criticalError);
      this.context.addError({
        timestamp: new Date().toISOString(),
        message: 'Erro crítico no processamento',
        details: criticalError instanceof Error ? criticalError.message : 'Erro desconhecido',
        failedItems: []
      });
      this.context.setStatus('idle');
    } finally {
      this.isRunning = false;
      console.log('[BatchProcessor] isRunning = false');
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
