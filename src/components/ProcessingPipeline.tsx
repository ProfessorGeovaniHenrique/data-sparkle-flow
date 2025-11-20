import { CheckCircle, Circle, Loader2 } from "lucide-react";

interface ProcessingPipelineProps {
  currentStep: 'upload' | 'extract' | 'enrich' | 'validate' | 'export';
}

const steps = [
  { key: 'upload', label: 'Upload de Arquivos' },
  { key: 'extract', label: 'Extração de Títulos' },
  { key: 'enrich', label: 'Busca de Metadados (IA)' },
  { key: 'validate', label: 'Validação' },
  { key: 'export', label: 'Exportação CSV' },
];

export const ProcessingPipeline = ({ currentStep }: ProcessingPipelineProps) => {
  const currentIndex = steps.findIndex(s => s.key === currentStep);
  
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isUpcoming = index > currentIndex;
          
          return (
            <div key={step.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2
                  ${isCompleted ? 'bg-success border-success text-success-foreground' : ''}
                  ${isCurrent ? 'bg-primary border-primary text-primary-foreground' : ''}
                  ${isUpcoming ? 'bg-muted border-muted-foreground/20 text-muted-foreground' : ''}
                `}>
                  {isCompleted && <CheckCircle className="w-5 h-5" />}
                  {isCurrent && <Loader2 className="w-5 h-5 animate-spin" />}
                  {isUpcoming && <Circle className="w-5 h-5" />}
                </div>
                <span className={`
                  mt-2 text-xs font-medium text-center
                  ${isCompleted ? 'text-success' : ''}
                  ${isCurrent ? 'text-primary' : ''}
                  ${isUpcoming ? 'text-muted-foreground' : ''}
                `}>
                  {step.label}
                </span>
              </div>
              
              {index < steps.length - 1 && (
                <div className={`
                  h-0.5 flex-1 mx-2 -mt-8
                  ${index < currentIndex ? 'bg-success' : 'bg-muted'}
                `} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
