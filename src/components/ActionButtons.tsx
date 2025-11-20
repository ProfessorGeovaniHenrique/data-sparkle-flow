import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Play, Download, Trash2, RefreshCw } from "lucide-react";

interface ActionButtonsProps {
  onBatchProcess?: () => void;
  onExport?: () => void;
  onClearPending?: () => void;
  onReset?: () => void;
  isProcessing?: boolean;
}

export const ActionButtons = ({
  onBatchProcess,
  onExport,
  onClearPending,
  onReset,
  isProcessing = false,
}: ActionButtonsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ações Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          className="w-full justify-start"
          variant="outline"
          onClick={onBatchProcess}
          disabled={isProcessing}
        >
          <Play className="w-4 h-4 mr-2" />
          Processamento em Lote
        </Button>
        <Button
          className="w-full justify-start"
          variant="outline"
          onClick={onExport}
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
        <Button
          className="w-full justify-start"
          variant="outline"
          onClick={onClearPending}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Limpar Pendentes
        </Button>
        <Button
          className="w-full justify-start"
          variant="destructive"
          onClick={onReset}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset Completo
        </Button>
      </CardContent>
    </Card>
  );
};
