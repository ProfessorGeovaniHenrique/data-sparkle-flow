import { createContext, useContext, ReactNode } from 'react';
import { BatchProcessingProvider, useBatchProcessing, BatchProcessingContextType } from './BatchProcessingContext';
import { ResultsProvider, useResults, ResultsContextType } from './ResultsContext';
import { WorkflowProvider, useWorkflow, WorkflowContextType } from './WorkflowContext';
import { storageService } from '@/lib/storage';
import { toast } from 'sonner';

// Re-export types for backward compatibility
export type { ProcessingStatus, ProcessingProgress, ProcessingError } from './BatchProcessingContext';

// Combined context type for backward compatibility
export interface ProcessingContextType extends BatchProcessingContextType, ResultsContextType, WorkflowContextType {
  clearSavedState: () => Promise<void>;
  getQueuedItems: () => { id: string; titulo: string; artista: string; fonte: string }[];
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

export const ProcessingProvider = ({ children }: { children: ReactNode }) => {
  return (
    <BatchProcessingProvider>
      <ResultsProvider>
        <WorkflowProvider>
          <ProcessingContextIntegrator>
            {children}
          </ProcessingContextIntegrator>
        </WorkflowProvider>
      </ResultsProvider>
    </BatchProcessingProvider>
  );
};

// Component that combines all contexts
const ProcessingContextIntegrator = ({ children }: { children: ReactNode }) => {
  const batchProcessing = useBatchProcessing();
  const results = useResults();
  const workflow = useWorkflow();

  const clearSavedState = async () => {
    try {
      await storageService.clearAll();
      batchProcessing.reset();
      results.clearResults();
      workflow.setSelectedTitles([]);
      toast.info('Estado limpo. Pronto para novo processamento.');
    } catch (error) {
      console.error('[ProcessingContext] Erro ao limpar estado salvo:', error);
    }
  };

  const getQueuedItems = () => {
    return workflow.getQueuedItems(results.results.length);
  };

  const combinedContext: ProcessingContextType = {
    ...batchProcessing,
    ...results,
    ...workflow,
    clearSavedState,
    getQueuedItems,
  };

  return (
    <ProcessingContext.Provider value={combinedContext}>
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
