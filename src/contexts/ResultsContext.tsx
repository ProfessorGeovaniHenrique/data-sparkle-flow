import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { EnrichedMusicData } from '@/lib/batchProcessor';
import { storageService } from '@/lib/storage';

interface ResultsState {
  results: EnrichedMusicData[];
}

export interface ResultsContextType extends ResultsState {
  setResults: (results: EnrichedMusicData[]) => void;
  updateResultItem: (id: string, changes: Partial<EnrichedMusicData>) => void;
  approveItem: (id: string) => void;
  approveMultiple: (ids: string[]) => void;
  getPendingItems: () => EnrichedMusicData[];
  getApprovedItems: () => EnrichedMusicData[];
  clearResults: () => void;
}

const ResultsContext = createContext<ResultsContextType | undefined>(undefined);

export const ResultsProvider = ({ children }: { children: ReactNode }) => {
  const [results, setResults] = useState<EnrichedMusicData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Carregar resultados do IndexedDB na montagem
  useEffect(() => {
    const loadResults = async () => {
      try {
        const savedResults = await storageService.loadResults();
        if (savedResults.length > 0) {
          setResults(savedResults);
          console.log(`[Results] ${savedResults.length} resultados carregados do IndexedDB`);
        }
      } catch (error) {
        console.error('[Results] Erro ao carregar resultados:', error);
      } finally {
        setIsInitialized(true);
      }
    };
    
    loadResults();
  }, []);

  // Salvar resultados no IndexedDB com debounce
  useEffect(() => {
    if (!isInitialized) return;

    const timeoutId = setTimeout(async () => {
      try {
        if (results.length > 0) {
          await storageService.saveResults(results);
          console.log(`[Results] ${results.length} resultados salvos no IndexedDB`);
        }
      } catch (error) {
        console.error('[Results] Erro ao salvar resultados:', error);
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          console.warn('[Results] Quota excedida. Limpando storage legado...');
          storageService.clearLegacyStorage();
        }
      }
    }, 2000); // Debounce de 2 segundos

    return () => clearTimeout(timeoutId);
  }, [results, isInitialized]);

  const updateResultItem = useCallback((id: string, changes: Partial<EnrichedMusicData>) => {
    setResults(prev => prev.map(item => 
      item.id === id ? { ...item, ...changes } : item
    ));
    toast.success('Item atualizado com sucesso.');
  }, []);

  const approveItem = useCallback((id: string) => {
    setResults(prev => prev.map(item => 
      item.id === id 
        ? { ...item, approval_status: 'approved' as const } 
        : item
    ));
    toast.success('Música aprovada!');
  }, []);

  const approveMultiple = useCallback((ids: string[]) => {
    setResults(prev => prev.map(item => 
      ids.includes(item.id || '') 
        ? { ...item, approval_status: 'approved' as const } 
        : item
    ));
    toast.success(`${ids.length} músicas aprovadas!`);
  }, []);

  const getPendingItems = useCallback(() => {
    return results.filter(r => r.approval_status !== 'approved');
  }, [results]);

  const getApprovedItems = useCallback(() => {
    return results.filter(r => r.approval_status === 'approved');
  }, [results]);

  const clearResults = useCallback(async () => {
    setResults([]);
    await storageService.clearResults();
    console.log('[Results] Resultados limpos');
  }, []);

  return (
    <ResultsContext.Provider
      value={{
        results,
        setResults,
        updateResultItem,
        approveItem,
        approveMultiple,
        getPendingItems,
        getApprovedItems,
        clearResults,
      }}
    >
      {children}
    </ResultsContext.Provider>
  );
};

export const useResults = () => {
  const context = useContext(ResultsContext);
  if (!context) {
    throw new Error('useResults must be used within ResultsProvider');
  }
  return context;
};
