import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TitleExtractionResultsProps {
  rawCount: number;
  cleanCount: number;
  detectionResults: Array<{
    file: string;
    sheet: string;
    columnIndex: number;
    columnName: string;
    titlesFound: number;
  }>;
}

export const TitleExtractionResults = ({ 
  rawCount, 
  cleanCount, 
  detectionResults 
}: TitleExtractionResultsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Extração de Títulos Concluída
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Títulos Encontrados</p>
            <p className="text-2xl font-bold">{rawCount}</p>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Títulos Únicos (Limpos)</p>
            <p className="text-2xl font-bold text-success">{cleanCount}</p>
          </div>
        </div>
        
        {detectionResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Detecção Automática:</p>
            {detectionResults.map((result, idx) => (
              <div key={idx} className="bg-muted/30 p-3 rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span className="font-medium">{result.file}</span>
                  <Badge variant="outline" className="ml-auto">{result.sheet}</Badge>
                </div>
                <p className="text-muted-foreground ml-6">
                  Coluna detectada: <span className="font-mono">{result.columnName}</span> ({result.titlesFound} títulos)
                </p>
              </div>
            ))}
          </div>
        )}
        
        <div className="text-xs text-muted-foreground">
          ✓ Prefixo "nome da musica:" removido automaticamente
        </div>
      </CardContent>
    </Card>
  );
};
