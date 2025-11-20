import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Edit } from "lucide-react";
import { MusicData } from "@/types/music";
import { useState } from "react";

interface ValidationTableProps {
  data: MusicData[];
  onValidate: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, data: Partial<MusicData>) => void;
}

export const ValidationTable = ({ data, onValidate, onReject, onEdit }: ValidationTableProps) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'validated' | 'rejected'>('all');
  
  const filteredData = data.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'pending') return item.status === 'enriched' || item.status === 'validating';
    return item.status === filter;
  });
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Validação de Dados</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todos ({data.length})
            </Button>
            <Button
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('pending')}
            >
              Pendentes ({data.filter(d => d.status === 'enriched' || d.status === 'validating').length})
            </Button>
            <Button
              variant={filter === 'validated' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('validated')}
            >
              Aprovados ({data.filter(d => d.status === 'validated').length})
            </Button>
            <Button
              variant={filter === 'rejected' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('rejected')}
            >
              Rejeitados ({data.filter(d => d.status === 'rejected').length})
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredData.map((item) => (
            <div key={item.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{item.processed_data?.nome_musica}</h3>
                  <p className="text-sm text-muted-foreground">{item.processed_data?.autor}</p>
                </div>
                <Badge variant={
                  item.status === 'validated' ? 'default' : 
                  item.status === 'rejected' ? 'destructive' : 
                  'secondary'
                }>
                  {item.status === 'validated' ? 'Aprovado' : 
                   item.status === 'rejected' ? 'Rejeitado' : 
                   'Pendente'}
                </Badge>
              </div>
              
              {item.enriched_data && (
                <div className="grid grid-cols-2 gap-2 text-sm bg-muted/50 p-3 rounded">
                  {item.enriched_data.compositor && (
                    <div>
                      <span className="text-muted-foreground">Compositor:</span>{' '}
                      <span className="font-medium">{item.enriched_data.compositor}</span>
                    </div>
                  )}
                  {item.enriched_data.ano_lancamento && (
                    <div>
                      <span className="text-muted-foreground">Ano:</span>{' '}
                      <span className="font-medium">{item.enriched_data.ano_lancamento}</span>
                    </div>
                  )}
                  {item.enriched_data.album && (
                    <div>
                      <span className="text-muted-foreground">Álbum:</span>{' '}
                      <span className="font-medium">{item.enriched_data.album}</span>
                    </div>
                  )}
                  {item.enriched_data.genero && (
                    <div>
                      <span className="text-muted-foreground">Gênero:</span>{' '}
                      <span className="font-medium">{item.enriched_data.genero}</span>
                    </div>
                  )}
                  {item.enriched_data.gravadora && (
                    <div>
                      <span className="text-muted-foreground">Gravadora:</span>{' '}
                      <span className="font-medium">{item.enriched_data.gravadora}</span>
                    </div>
                  )}
                  {item.enriched_data.pais_origem && (
                    <div>
                      <span className="text-muted-foreground">País:</span>{' '}
                      <span className="font-medium">{item.enriched_data.pais_origem}</span>
                    </div>
                  )}
                </div>
              )}
              
              {(item.status === 'enriched' || item.status === 'validating') && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onValidate(item.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => onReject(item.id)}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Rejeitar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // For now, just a placeholder
                      console.log('Edit:', item.id);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          
          {filteredData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum registro para validar
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
