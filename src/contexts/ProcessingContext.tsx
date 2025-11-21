import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { EnrichedMusicData } from '@/lib/batchProcessor';

export type ProcessingStatus = 'idle' | 'extracting' | 'processing' | 'enriching' | 'paused' | 'cancelled' | 'completed';

const STORAGE_KEY = 'MUSIC_ENRICHER_STATE_V1';

export interface ProcessingError {
  timestamp: string;
  message: string;
  details?: string;
  failedItems: string[];
}

export interface ProcessingProgress {
  current: number;
  total: number;
  percentage: number;
  itemsPerSecond?: number;
  estimatedTimeRemaining?: number;
  speed?: number;
  eta?: number;
}

interface ProcessingState {
  status: ProcessingStatus;
  canPause: boolean;
  canCancel: boolean;
  progress: ProcessingProgress;
  errors: ProcessingError[];
  selectedTitles: string[];
  results: EnrichedMusicData[];
}

export interface ProcessingContextType extends ProcessingState {
  setStatus: (status: ProcessingStatus) => void;
  setProgress: (progress: Partial<ProcessingProgress>) => void;
  addError: (error: ProcessingError) => void;
  clearErrors: () => void;
  setSelectedTitles: (titles: string[]) => void;
  setResults: (results: EnrichedMusicData[]) => void;
  updateResultItem: (id: string, changes: Partial<EnrichedMusicData>) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
  clearSavedState: () => void;
  approveItem: (id: string) => void;
  approveMultiple: (ids: string[]) => void;
  getPendingItems: () => EnrichedMusicData[];
  getApprovedItems: () => EnrichedMusicData[];
  getQueuedItems: () => { id: string; titulo: string; artista: string; fonte: string }[];
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

const initialProgress: ProcessingProgress = {
  current: 0,
  total: 0,
  percentage: 0,
  itemsPerSecond: 0,
  estimatedTimeRemaining: 0,
  speed: 0,
  eta: 0,
};

export const ProcessingProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgressState] = useState<ProcessingProgress>(initialProgress);
  const [errors, setErrors] = useState<ProcessingError[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [results, setResults] = useState<EnrichedMusicData[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const canPause = status === 'extracting' || status === 'enriching';
  const canCancel = status !== 'idle' && status !== 'completed' && status !== 'cancelled';

  // Carregar estado salvo do localStorage na montagem
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        
        // Restaurar estado salvo
        setStatus(parsed.status === 'running' ? 'paused' : parsed.status || 'idle');
        setProgressState(parsed.progress || initialProgress);
        setErrors(parsed.errors || []);
        setResults(parsed.results || []);
        setSelectedTitles(parsed.selectedTitles || []);
        
        if (parsed.results && parsed.results.length > 0) {
          toast.info(`Progresso anterior restaurado: ${parsed.results.length} músicas processadas.`);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar estado salvo:', error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Salvar estado automaticamente (com debounce)
  useEffect(() => {
    if (!isInitialized) return;

    const timeoutId = setTimeout(() => {
      try {
        const stateToSave = {
          status,
          progress,
          errors,
          results,
          selectedTitles,
          timestamp: Date.now()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      } catch (error) {
        console.error('Erro ao salvar estado:', error);
      }
    }, 2000); // Debounce de 2 segundos

    return () => clearTimeout(timeoutId);
  }, [status, progress, errors, results, selectedTitles, isInitialized]);

  const setProgress = useCallback((newProgress: Partial<ProcessingProgress>) => {
    setProgressState(prev => {
      const updated = { ...prev, ...newProgress };
      updated.percentage = updated.total > 0 ? (updated.current / updated.total) * 100 : 0;
      return updated;
    });
  }, []);

  const addError = useCallback((error: ProcessingError) => {
    setErrors(prev => [...prev, error]);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const pause = useCallback(() => {
    if (canPause) {
      setStatus('paused');
    }
  }, [canPause]);

  const resume = useCallback(() => {
    if (status === 'paused') {
      setStatus('enriching');
    }
  }, [status]);

  const cancel = useCallback(() => {
    if (canCancel) {
      setStatus('cancelled');
    }
  }, [canCancel]);

  const updateResultItem = useCallback((id: string, changes: Partial<EnrichedMusicData>) => {
    setResults(prev => prev.map(item => 
      item.id === id ? { ...item, ...changes } : item
    ));
    toast.success('Item atualizado com sucesso.');
  }, []);

  const reset = useCallback(() => {
    console.log('[ProcessingContext] reset() chamado');
    setStatus('idle');
    setProgressState(initialProgress);
    setErrors([]);
    setSelectedTitles([]);
    setResults([]);
    console.log('[ProcessingContext] Status resetado para idle');
  }, []);

  const clearSavedState = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      reset();
      toast.info('Estado limpo. Pronto para novo processamento.');
    } catch (error) {
      console.error('Erro ao limpar estado salvo:', error);
    }
  }, [reset]);

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

  const getQueuedItems = useCallback(() => {
    const processedCount = results.length;
    return selectedTitles.slice(processedCount).map((titulo, idx) => ({
      id: `queued-${idx}`,
      titulo,
      artista: '',
      fonte: 'upload'
    }));
  }, [results, selectedTitles]);

  return (
    <ProcessingContext.Provider
      value={{
        status,
        canPause,
        canCancel,
        progress,
        errors,
        selectedTitles,
        results,
        setStatus,
        setProgress,
        addError,
        clearErrors,
        setSelectedTitles,
        setResults,
        updateResultItem,
        pause,
        resume,
        cancel,
        reset,
        clearSavedState,
        approveItem,
        approveMultiple,
        getPendingItems,
        getApprovedItems,
        getQueuedItems,
      }}
    >
      {children}
    </ProcessingContext.Provider>
  );
};

export const useProcessing = () => {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessing must be used within ProcessingProvider');
  }
  return context;
};
