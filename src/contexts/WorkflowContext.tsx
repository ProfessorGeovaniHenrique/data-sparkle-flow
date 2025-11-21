import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface WorkflowState {
  selectedTitles: string[];
}

export interface WorkflowContextType extends WorkflowState {
  setSelectedTitles: (titles: string[]) => void;
  reorderQueue: (newOrder: string[]) => void;
  getQueuedItems: (processedCount: number) => { id: string; titulo: string; artista: string; fonte: string }[];
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export const WorkflowProvider = ({ children }: { children: ReactNode }) => {
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);

  const getQueuedItems = useCallback((processedCount: number) => {
    return selectedTitles.slice(processedCount).map((titulo, idx) => ({
      id: `queued-${idx}`,
      titulo,
      artista: '',
      fonte: 'upload'
    }));
  }, [selectedTitles]);

  const reorderQueue = useCallback((newOrder: string[]) => {
    console.log('[Workflow] Reordenando fila:', newOrder.length, 'itens');
    setSelectedTitles(newOrder);
  }, []);

  return (
    <WorkflowContext.Provider
      value={{
        selectedTitles,
        setSelectedTitles,
        reorderQueue,
        getQueuedItems,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
};

export const useWorkflow = () => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider');
  }
  return context;
};
