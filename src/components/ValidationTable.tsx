import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Pencil } from "lucide-react";

export interface EnrichedMusicItem {
  titulo_original: string;
  artista_encontrado: string;
  compositor_encontrado: string;
  ano_lancamento: string;
  observacoes?: string;
  status_pesquisa: 'Sucesso' | 'Falha';
}

interface ValidationTableProps {
  data: EnrichedMusicItem[];
  onValidate?: (index: number) => void;
  onReject?: (index: number) => void;
  onEdit?: (index: number) => void;
}

export const ValidationTable = ({ data, onValidate, onReject, onEdit }: ValidationTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dados Enriquecidos - Revisão</CardTitle>
        <p className="text-sm text-muted-foreground">
          Revise os metadados encontrados pela IA antes de exportar
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {data.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado disponível para validação
            </p>
          ) : (
            data.map((item, index) => (
              <div 
                key={index} 
                className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{item.titulo_original}</h3>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Artista:</span>
                        <p className="font-medium">{item.artista_encontrado}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Compositor:</span>
                        <p className="font-medium">{item.compositor_encontrado}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ano:</span>
                        <p className="font-medium">{item.ano_lancamento}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <Badge 
                          variant={item.status_pesquisa === 'Sucesso' ? 'default' : 'destructive'}
                          className="ml-2"
                        >
                          {item.status_pesquisa}
                        </Badge>
                      </div>
                    </div>
                    {item.observacoes && (
                      <div className="mt-2 bg-muted/50 p-2 rounded text-xs">
                        <span className="font-medium">Observações:</span> {item.observacoes}
                      </div>
                    )}
                  </div>
                  
                  {onEdit && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(index)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
