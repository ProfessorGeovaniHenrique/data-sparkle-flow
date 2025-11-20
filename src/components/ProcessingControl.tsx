import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pause, Play, X, Clock, Zap, CheckCircle2, AlertCircle, XCircle, FileMusic } from "lucide-react";
import { useProcessing } from "@/contexts/ProcessingContext";
import { useMemo } from "react";

export const ProcessingControl = () => {
  const { status, canPause, canCancel, progress, results, pause, resume, cancel } = useProcessing();

  if (status === 'idle' || status === 'completed') return null;

  // Calcular estatísticas de status dos resultados
  const statusStats = useMemo(() => {
    const stats = {
      sucesso: 0,
      parcial: 0,
      coverIdentificado: 0,
      falha: 0,
      naoEncontrado: 0
    };

    results.forEach(item => {
      const statusLower = item.status_pesquisa.toLowerCase();
      if (statusLower === 'sucesso') stats.sucesso++;
      else if (statusLower === 'parcial') stats.parcial++;
      else if (statusLower.includes('cover')) stats.coverIdentificado++;
      else if (statusLower.includes('falha')) stats.falha++;
      else if (statusLower.includes('não encontrado')) stats.naoEncontrado++;
    });

    return stats;
  }, [results]);

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
              {progress.speed > 0 ? `${progress.speed.toFixed(1)} músicas/s` : 'Calculando...'}
            </p>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              <span>Tempo Restante</span>
            </div>
            <p className="text-lg font-semibold">
              {progress.eta > 0 ? formatTime(progress.eta) : 'Calculando...'}
            </p>
          </div>
        </div>

        {/* Estatísticas de Status */}
        {results.length > 0 && (
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2 mb-3">
              <FileMusic className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Estatísticas de Processamento</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-muted-foreground">Sucesso:</span>
                <span className="font-semibold text-green-600">{statusStats.sucesso}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600" />
                <span className="text-muted-foreground">Parcial:</span>
                <span className="font-semibold text-yellow-600">{statusStats.parcial}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileMusic className="w-4 h-4 text-blue-600" />
                <span className="text-muted-foreground">Cover:</span>
                <span className="font-semibold text-blue-600">{statusStats.coverIdentificado}</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-muted-foreground">Falha:</span>
                <span className="font-semibold text-red-600">{statusStats.falha}</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="text-muted-foreground">Não Encontrado:</span>
                <span className="font-semibold text-orange-600">{statusStats.naoEncontrado}</span>
              </div>
            </div>
          </div>
        )}

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
