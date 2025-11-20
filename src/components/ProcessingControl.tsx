import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, X, Clock, Zap } from "lucide-react";
import { useProcessing } from "@/contexts/ProcessingContext";

export const ProcessingControl = () => {
  const { status, canPause, canCancel, progress, pause, resume, cancel } = useProcessing();

  if (status === 'idle' || status === 'completed') return null;

  const formatTime = (seconds: number) => {
    if (seconds === 0 || !isFinite(seconds)) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="border-primary/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Controle de Processamento</span>
          <div className="flex gap-2">
            {canPause && status !== 'paused' && (
              <Button size="sm" variant="outline" onClick={pause}>
                <Pause className="w-4 h-4 mr-1" />
                Pausar
              </Button>
            )}
            {status === 'paused' && (
              <Button size="sm" variant="default" onClick={resume}>
                <Play className="w-4 h-4 mr-1" />
                Retomar
              </Button>
            )}
            {canCancel && (
              <Button size="sm" variant="destructive" onClick={cancel}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Progresso</span>
            <span className="font-medium">
              {progress.current} / {progress.total} ({progress.percentage.toFixed(1)}%)
            </span>
          </div>
          <Progress value={progress.percentage} className="h-3" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Zap className="w-4 h-4" />
              <span>Velocidade</span>
            </div>
            <p className="text-lg font-semibold">
              {progress.speed > 0 ? `${progress.speed.toFixed(1)}/s` : '--'}
            </p>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span>Tempo Restante</span>
            </div>
            <p className="text-lg font-semibold">{formatTime(progress.eta)}</p>
          </div>
        </div>

        {status === 'paused' && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 text-sm">
            ⏸️ Processamento pausado. Clique em "Retomar" para continuar.
          </div>
        )}
        
        {status === 'cancelled' && (
          <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 text-sm">
            ⛔ Processamento cancelado pelo usuário.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
