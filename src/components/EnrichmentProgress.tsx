import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles, CheckCircle, XCircle } from "lucide-react";
import { useProcessing } from "@/contexts/ProcessingContext";

interface EnrichmentProgressProps {
  successCount: number;
  failureCount: number;
}

export const EnrichmentProgress = ({ successCount, failureCount }: EnrichmentProgressProps) => {
  const { progress, status } = useProcessing();
  const percentage = progress.percentage;
  const successRate = progress.current > 0 ? (successCount / progress.current) * 100 : 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-enriched" />
          Enriquecimento via IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">{progress.current} de {progress.total}</span>
          </div>
          <Progress value={percentage} className="h-3" />
        </div>

        {/* Success/Failure Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Taxa de Sucesso: {successRate.toFixed(1)}%</span>
            <span>{successCount} sucessos / {failureCount} falhas</span>
          </div>
          <div className="h-6 bg-muted rounded-lg overflow-hidden flex">
            {successCount > 0 && (
              <div 
                className="bg-success flex items-center justify-center text-xs text-white font-medium"
                style={{ width: `${(successCount / progress.current) * 100}%` }}
              >
                {successCount > 0 && <CheckCircle className="w-3 h-3" />}
              </div>
            )}
            {failureCount > 0 && (
              <div 
                className="bg-destructive flex items-center justify-center text-xs text-white font-medium"
                style={{ width: `${(failureCount / progress.current) * 100}%` }}
              >
                {failureCount > 0 && <XCircle className="w-3 h-3" />}
              </div>
            )}
          </div>
        </div>
        
        {status !== 'completed' && progress.current < progress.total && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Status:</p>
            <p className="text-sm font-medium">
              {status === 'paused' ? '⏸️ Pausado' : '🔄 Processando...'}
            </p>
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          {percentage === 100 ? (
            <span className="text-success">✓ Enriquecimento concluído!</span>
          ) : (
            <span>Coletando informações adicionais via IA...</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
