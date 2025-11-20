import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Save, X } from "lucide-react";
import { useState } from "react";

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
  onUpdate?: (index: number, updatedItem: EnrichedMusicItem) => void;
}

type FilterType = 'all' | 'success' | 'failed';

export const ValidationTable = ({ data, onUpdate }: ValidationTableProps) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedItem, setEditedItem] = useState<EnrichedMusicItem | null>(null);

  const filteredData = data.filter(item => {
    if (filter === 'success') return item.status_pesquisa === 'Sucesso';
    if (filter === 'failed') return item.status_pesquisa === 'Falha';
    return true;
  });

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditedItem({ ...data[index] });
  };

  const handleSave = () => {
    if (editingIndex !== null && editedItem && onUpdate) {
      onUpdate(editingIndex, editedItem);
      setEditingIndex(null);
      setEditedItem(null);
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditedItem(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Dados Enriquecidos - Revisão</CardTitle>
        <p className="text-sm text-muted-foreground">
          Revise os metadados encontrados pela IA antes de exportar
        </p>
        
        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
          >
            Todos ({data.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'success' ? 'default' : 'outline'}
            onClick={() => setFilter('success')}
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Sucessos ({data.filter(d => d.status_pesquisa === 'Sucesso').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'failed' ? 'default' : 'outline'}
            onClick={() => setFilter('failed')}
          >
            <XCircle className="w-4 h-4 mr-1" />
            Falhas ({data.filter(d => d.status_pesquisa === 'Falha').length})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {filteredData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado disponível para validação
            </p>
          ) : (
            filteredData.map((item, displayIndex) => {
              const actualIndex = data.indexOf(item);
              const isEditing = editingIndex === actualIndex;
              
              return (
                <div 
                  key={actualIndex} 
                  className="border rounded-lg p-4 space-y-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-3">{item.titulo_original}</h3>
                      
                      {isEditing && editedItem ? (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground block mb-1">Artista:</span>
                            <Input
                              value={editedItem.artista_encontrado}
                              onChange={(e) => setEditedItem({ ...editedItem, artista_encontrado: e.target.value })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Compositor:</span>
                            <Input
                              value={editedItem.compositor_encontrado}
                              onChange={(e) => setEditedItem({ ...editedItem, compositor_encontrado: e.target.value })}
                              className="h-8"
                            />
                          </div>
                          <div>
                            <span className="text-muted-foreground block mb-1">Ano:</span>
                            <Input
                              value={editedItem.ano_lancamento}
                              onChange={(e) => setEditedItem({ ...editedItem, ano_lancamento: e.target.value })}
                              className="h-8"
                              placeholder="YYYY"
                            />
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
                      ) : (
                        <div className="grid grid-cols-2 gap-2 text-sm">
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
                      )}
                      
                      {item.observacoes && (
                        <div className="mt-2 bg-muted/50 p-2 rounded text-xs">
                          <span className="font-medium">Observações:</span> {item.observacoes}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={handleSave}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancel}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(actualIndex)}
                        >
                          Editar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};
