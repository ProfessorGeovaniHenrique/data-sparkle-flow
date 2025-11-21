import { get, set, del } from 'idb-keyval';
import { EnrichedMusicData } from './batchProcessor';

const RESULTS_KEY = 'music_enricher_results';
const METADATA_KEY = 'music_enricher_metadata';

export interface StorageMetadata {
  status: string;
  progress: {
    current: number;
    total: number;
    percentage: number;
    speed?: number;
    eta?: number;
  };
  timestamp: number;
}

/**
 * Serviço de armazenamento híbrido:
 * - IndexedDB para dados pesados (results)
 * - localStorage para metadados leves (status, progress)
 */
export const storageService = {
  /**
   * Salva resultados processados no IndexedDB (assíncrono, não trava UI)
   */
  async saveResults(results: EnrichedMusicData[]): Promise<void> {
    try {
      console.log(`[Storage] Salvando ${results.length} resultados no IndexedDB`);
      await set(RESULTS_KEY, results);
    } catch (error) {
      console.error('[Storage] Erro ao salvar resultados:', error);
      throw error;
    }
  },

  /**
   * Carrega resultados do IndexedDB
   */
  async loadResults(): Promise<EnrichedMusicData[]> {
    try {
      const results = await get<EnrichedMusicData[]>(RESULTS_KEY);
      console.log(`[Storage] Carregados ${results?.length || 0} resultados do IndexedDB`);
      return results || [];
    } catch (error) {
      console.error('[Storage] Erro ao carregar resultados:', error);
      return [];
    }
  },

  /**
   * Limpa resultados do IndexedDB
   */
  async clearResults(): Promise<void> {
    try {
      await del(RESULTS_KEY);
      console.log('[Storage] Resultados limpos do IndexedDB');
    } catch (error) {
      console.error('[Storage] Erro ao limpar resultados:', error);
    }
  },

  /**
   * Salva metadados leves no localStorage (síncrono, rápido)
   */
  saveMetadata(metadata: StorageMetadata): void {
    try {
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('[Storage] Erro ao salvar metadados:', error);
      // Se falhar, tenta limpar localStorage antigo
      this.clearLegacyStorage();
    }
  },

  /**
   * Carrega metadados do localStorage
   */
  loadMetadata(): StorageMetadata | null {
    try {
      const data = localStorage.getItem(METADATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[Storage] Erro ao carregar metadados:', error);
      return null;
    }
  },

  /**
   * Limpa storage legado (localStorage com results grandes)
   */
  clearLegacyStorage(): void {
    try {
      localStorage.removeItem('MUSIC_ENRICHER_STATE_V1');
      console.log('[Storage] Storage legado limpo');
    } catch (error) {
      console.error('[Storage] Erro ao limpar storage legado:', error);
    }
  },

  /**
   * Limpa todos os dados
   */
  async clearAll(): Promise<void> {
    await this.clearResults();
    localStorage.removeItem(METADATA_KEY);
    this.clearLegacyStorage();
  }
};
