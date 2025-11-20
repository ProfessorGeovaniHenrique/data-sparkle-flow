import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

interface EnrichmentProgressProps {
  total: number;
  processed: number;
  currentSong?: string;
}

export const EnrichmentProgress = ({ total, processed, currentSong }: EnrichmentProgressProps) => {
  const percentage = total > 0 ? (processed / total) * 100 : 0;
  
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
            <span className="font-medium">{processed} de {total}</span>
          </div>
          <Progress value={percentage} className="h-2" />
        </div>
        
        {currentSong && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Processando agora:</p>
            <p className="text-sm font-medium">{currentSong}</p>
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
