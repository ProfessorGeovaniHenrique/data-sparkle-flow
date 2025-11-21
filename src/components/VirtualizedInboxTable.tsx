import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, ChevronLeft, ChevronRight, Edit2, Check, X as XIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EnrichedMusicData } from '@/lib/batchProcessor';
import { useProcessing } from '@/contexts/ProcessingContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface VirtualizedInboxTableProps {
  items: EnrichedMusicData[];
}

type EditableField = 'artista_encontrado' | 'compositor_encontrado' | 'ano_lancamento';

interface EditingCell {
  rowId: string;
  field: EditableField;
}

const ITEMS_PER_PAGE = 100;
const ROW_HEIGHT = 60;

export const VirtualizedInboxTable = ({ items }: VirtualizedInboxTableProps) => {
  const { approveItem, approveMultiple, updateResultItem } = useProcessing();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      item.titulo_original.toLowerCase().includes(term) ||
      item.artista_encontrado.toLowerCase().includes(term) ||
      item.compositor_encontrado.toLowerCase().includes(term)
    );
  }, [items, searchTerm]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: paginatedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleApproveSelected = () => {
    if (selectedIds.length > 0) {
      approveMultiple(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleApproveAll = () => {
    const ids = paginatedItems.map(i => i.id || '').filter(id => id);
    approveMultiple(ids);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    const allIds = paginatedItems.map(i => i.id || '').filter(id => id);
    setSelectedIds(prev => prev.length === allIds.length ? [] : allIds);
  };

  const startEditing = (rowId: string, field: EditableField, currentValue: string) => {
    setEditingCell({ rowId, field });
    setEditValue(currentValue);
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const { rowId, field } = editingCell;
    const trimmedValue = editValue.trim();

    if (field === 'ano_lancamento') {
      const yearMatch = trimmedValue.match(/^\d{4}$/);
      if (!yearMatch) {
        toast.error('Ano inválido. Use o formato YYYY (ex: 2020).');
        return;
      }
      const year = parseInt(trimmedValue, 10);
      const currentYear = new Date().getFullYear();
      if (year < 1900 || year > currentYear + 1) {
        toast.error(`Ano deve estar entre 1900 e ${currentYear + 1}.`);
        return;
      }
    }

    if (!trimmedValue) {
      toast.error('O valor não pode estar vazio.');
      return;
    }

    updateResultItem(rowId, { [field]: trimmedValue });
    cancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    else if (e.key === 'Escape') cancelEditing();
  };

  const getRowHighlight = (item: EnrichedMusicData) => {
    if (item.status_pesquisa === 'Parcial' || item.ano_lancamento === '0000') {
      return 'bg-yellow-50 dark:bg-yellow-950/20';
    }
    if (item.status_pesquisa === 'Sucesso' || item.status_pesquisa === 'Sucesso (Web)') {
      return 'bg-green-50/50 dark:bg-green-950/10';
    }
    return 'bg-red-50/30 dark:bg-red-950/10';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Revisão de Metadados</CardTitle>
            <CardDescription className="mt-1">
              {items.length} músicas aguardando validação
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleApproveSelected}
              disabled={selectedIds.length === 0}
              variant="outline"
              size="sm"
            >
              Aprovar Selecionados ({selectedIds.length})
            </Button>
            <Button
              onClick={handleApproveAll}
              className="bg-green-600 hover:bg-green-700"
              size="sm"
            >
              Aprovar Todas desta Página
            </Button>
          </div>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, artista ou compositor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho da tabela */}
        <div className="flex items-center border-b bg-muted/50 px-4 py-3 font-medium text-sm">
          <div className="w-12 flex-shrink-0">
            <Checkbox
              checked={selectedIds.length === paginatedItems.length && paginatedItems.length > 0}
              onCheckedChange={handleSelectAll}
            />
          </div>
          <div className="w-[25%] flex-shrink-0 pr-4">Título</div>
          <div className="w-[18%] flex-shrink-0 pr-4">Artista</div>
          <div className="w-[18%] flex-shrink-0 pr-4">Compositor</div>
          <div className="w-[10%] flex-shrink-0 pr-4">Ano</div>
          <div className="w-[10%] flex-shrink-0 pr-4">Status</div>
          <div className="w-[12%] flex-shrink-0">Ações</div>
        </div>

        {/* Lista virtualizada */}
        <div 
          ref={parentRef}
          className="border rounded-md overflow-auto"
          style={{ height: '600px' }}
        >
          {paginatedItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? `Nenhum resultado para "${searchTerm}"` : 'Nenhuma música para revisar'}
            </div>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const item = paginatedItems[virtualRow.index];
                const rowId = item.id || `row-${virtualRow.index}`;
                
                return (
                  <div
                    key={virtualRow.key}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={cn('flex items-center border-b px-4', getRowHighlight(item))}
                  >
                    {/* Checkbox */}
                    <div className="w-12 flex-shrink-0">
                      <Checkbox
                        checked={selectedIds.includes(rowId)}
                        onCheckedChange={() => toggleSelection(rowId)}
                      />
                    </div>

                    {/* Título */}
                    <div className="w-[25%] flex-shrink-0 pr-4 font-medium truncate">
                      {item.titulo_original}
                    </div>

                    {/* Artista - Editável */}
                    <div className="w-[18%] flex-shrink-0 pr-4">
                      {editingCell?.rowId === rowId && editingCell?.field === 'artista_encontrado' ? (
                        <div className="flex items-center gap-1">
                          <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyDown}
                            className="h-8 text-sm"
                          />
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={saveEdit}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={cancelEditing}>
                            <XIcon className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-2 group cursor-pointer hover:bg-muted/50 rounded px-2 py-1",
                            item.artista_encontrado === 'Não Identificado' && "bg-yellow-100 dark:bg-yellow-950/30"
                          )}
                          onClick={() => startEditing(rowId, 'artista_encontrado', item.artista_encontrado)}
                        >
                          <span className="truncate">{item.artista_encontrado}</span>
                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
                        </div>
                      )}
                    </div>

                    {/* Compositor - Editável */}
                    <div className="w-[18%] flex-shrink-0 pr-4">
                      {editingCell?.rowId === rowId && editingCell?.field === 'compositor_encontrado' ? (
                        <div className="flex items-center gap-1">
                          <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyDown}
                            className="h-8 text-sm"
                          />
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={saveEdit}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={cancelEditing}>
                            <XIcon className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-2 group cursor-pointer hover:bg-muted/50 rounded px-2 py-1",
                            item.compositor_encontrado === 'Não Identificado' && "bg-yellow-100 dark:bg-yellow-950/30"
                          )}
                          onClick={() => startEditing(rowId, 'compositor_encontrado', item.compositor_encontrado)}
                        >
                          <span className="truncate">{item.compositor_encontrado}</span>
                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
                        </div>
                      )}
                    </div>

                    {/* Ano - Editável */}
                    <div className="w-[10%] flex-shrink-0 pr-4">
                      {editingCell?.rowId === rowId && editingCell?.field === 'ano_lancamento' ? (
                        <div className="flex items-center gap-1">
                          <Input
                            ref={inputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyDown}
                            className="h-8 text-sm w-20"
                            maxLength={4}
                          />
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={saveEdit}>
                            <Check className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={cancelEditing}>
                            <XIcon className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "flex items-center gap-2 group cursor-pointer hover:bg-muted/50 rounded px-2 py-1",
                            item.ano_lancamento === '0000' && "bg-yellow-100 dark:bg-yellow-950/30"
                          )}
                          onClick={() => startEditing(rowId, 'ano_lancamento', item.ano_lancamento === '0000' ? '' : item.ano_lancamento)}
                        >
                          <span>{item.ano_lancamento === '0000' ? '-' : item.ano_lancamento}</span>
                          <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="w-[10%] flex-shrink-0 pr-4">
                      {item.status_pesquisa === 'Sucesso' || item.status_pesquisa === 'Sucesso (Web)' ? (
                        <Badge variant="default" className="gap-1 bg-green-500/10 text-green-700 border-green-500/20">
                          Sucesso
                        </Badge>
                      ) : item.status_pesquisa === 'Parcial' ? (
                        <Badge variant="outline" className="gap-1 bg-yellow-500/10 text-yellow-700 border-yellow-500/20">
                          Parcial
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          Falha
                        </Badge>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="w-[12%] flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        onClick={() => approveItem(rowId)}
                      >
                        Aprovar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} de {filteredData.length}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 px-3 py-1 text-sm">
                Página {currentPage} de {totalPages}
              </div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
