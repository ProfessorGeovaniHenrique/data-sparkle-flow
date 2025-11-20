import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, RefreshCw, Download, ChevronDown, ChevronUp } from "lucide-react";
import { useProcessing } from "@/contexts/ProcessingContext";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ErrorLogProps {
  onRetry?: (failedItems: string[]) => void;
}

export const ErrorLog = ({ onRetry }: ErrorLogProps) => {
  const { errors, clearErrors } = useProcessing();
  const [isOpen, setIsOpen] = useState(false);

  if (errors.length === 0) return null;

  const handleExportLog = () => {
    const logContent = errors.map(err => 
      `${err.timestamp}\t${err.message}\t${err.details || ''}\t${err.failedItems.join(', ')}`
    ).join('\n');
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'error-log.txt';
    link.click();
  };

  const handleRetry = () => {
    const failedItems = errors.flatMap(err => err.failedItems);
    if (onRetry) {
      onRetry(failedItems);
      clearErrors();
    }
  };

  return (
    <Card className="border-destructive/50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <CollapsibleTrigger className="w-full">
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Log de Erros
                <Badge variant="destructive">{errors.length}</Badge>
              </div>
              {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </CardTitle>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3">
            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {errors.map((error, idx) => (
                <div key={idx} className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium mb-1">{error.message}</p>
                      <p className="text-xs text-muted-foreground">{error.details}</p>
                      {error.failedItems.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Itens falhos: {error.failedItems.slice(0, 3).join(', ')}
                          {error.failedItems.length > 3 && ` +${error.failedItems.length - 3} mais`}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(error.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              {onRetry && (
                <Button size="sm" variant="outline" onClick={handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Reprocessar Falhas
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleExportLog}>
                <Download className="w-4 h-4 mr-1" />
                Exportar Log
              </Button>
              <Button size="sm" variant="ghost" onClick={clearErrors}>
                Limpar
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
