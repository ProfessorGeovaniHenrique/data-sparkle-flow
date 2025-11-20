import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type ProcessingStatus = 'idle' | 'extracting' | 'enriching' | 'paused' | 'cancelled' | 'completed';

interface ProcessingError {
  item: string;
  error: string;
  timestamp: Date;
}

interface ProcessingProgress {
  current: number;
  total: number;
  percentage: number;
  speed: number;
  eta: number;
}

interface ProcessingState {
  status: ProcessingStatus;
  canPause: boolean;
  canCancel: boolean;
  progress: ProcessingProgress;
  errors: ProcessingError[];
  selectedTitles: string[];
}

interface ProcessingContextType extends ProcessingState {
  setStatus: (status: ProcessingStatus) => void;
  setProgress: (progress: Partial<ProcessingProgress>) => void;
  addError: (error: ProcessingError) => void;
  clearErrors: () => void;
  setSelectedTitles: (titles: string[]) => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  reset: () => void;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

const initialProgress: ProcessingProgress = {
  current: 0,
  total: 0,
  percentage: 0,
  speed: 0,
  eta: 0,
};

export const ProcessingProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgressState] = useState<ProcessingProgress>(initialProgress);
  const [errors, setErrors] = useState<ProcessingError[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);

  const canPause = status === 'extracting' || status === 'enriching';
  const canCancel = status !== 'idle' && status !== 'completed' && status !== 'cancelled';

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

  const reset = useCallback(() => {
    setStatus('idle');
    setProgressState(initialProgress);
    setErrors([]);
    setSelectedTitles([]);
  }, []);

  return (
    <ProcessingContext.Provider
      value={{
        status,
        canPause,
        canCancel,
        progress,
        errors,
        selectedTitles,
        setStatus,
        setProgress,
        addError,
        clearErrors,
        setSelectedTitles,
        pause,
        resume,
        cancel,
        reset,
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
