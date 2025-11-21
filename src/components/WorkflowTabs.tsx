import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Inbox, CheckCircle2, Search, ChevronLeft, ChevronRight, Edit2, Check, X as XIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EnrichedMusicData } from '@/lib/batchProcessor';
import { useProcessing } from '@/contexts/ProcessingContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { DraggableQueueTable } from './DraggableQueueTable';
import { AdvancedExportMenu } from './AdvancedExportMenu';

interface WorkflowTabsProps {
  queuedItems: { id: string; titulo: string; artista: string; fonte: string }[];
  pendingItems: EnrichedMusicData[];
  approvedItems: EnrichedMusicData[];
  isProcessing: boolean;
}

type EditableField = 'artista_encontrado' | 'compositor_encontrado' | 'ano_lancamento';

interface EditingCell {
  rowId: string;
  field: EditableField;
}

const ITEMS_PER_PAGE = 50;

export const WorkflowTabs = ({ queuedItems, pendingItems, approvedItems, isProcessing }: WorkflowTabsProps) => {
  return (
    <Tabs defaultValue="inbox" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="queue" className="gap-2">
          <Clock className="w-4 h-4" />
          Fila ({queuedItems.length})
        </TabsTrigger>
        <TabsTrigger value="inbox" className="gap-2">
          <Inbox className="w-4 h-4" />
          Revisão ({pendingItems.length})
        </TabsTrigger>
        <TabsTrigger value="done" className="gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Aprovadas ({approvedItems.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="queue">
        <DraggableQueueTable items={queuedItems} />
      </TabsContent>

      <TabsContent value="inbox">
        <InboxTable items={pendingItems} />
      </TabsContent>

      <TabsContent value="done">
        <ApprovedTable items={approvedItems} />
      </TabsContent>
    </Tabs>
  );
};

const QueueTable = ({ items }: { items: { id: string; titulo: string }[] }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const paginatedItems = items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Fila de Processamento</CardTitle>
        <CardDescription>{items.length} músicas aguardando processamento</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[80%]">Título</TableHead>
                <TableHead className="w-[20%]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.titulo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <Clock className="w-3 h-3" />
                      Aguardando
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, items.length)} de {items.length}
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

const InboxTable = ({ items }: { items: EnrichedMusicData[] }) => {
  const { approveItem, approveMultiple, updateResultItem } = useProcessing();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0);
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const [feedbackAnimations, setFeedbackAnimations] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const showApprovalFeedback = (id: string) => {
    setFeedbackAnimations(prev => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setFeedbackAnimations(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    }, 1000);
  };

  // Reset selectedRowIndex ao mudar página ou filtro
  useEffect(() => {
    setSelectedRowIndex(0);
  }, [currentPage, searchTerm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCell) return;

      if (['ArrowUp', 'ArrowDown', 'a', 'A', 'e', 'E', 'Enter'].includes(e.key)) {
        setIsKeyboardMode(true);
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedRowIndex(prev => Math.min(prev + 1, paginatedItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedRowIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        const item = paginatedItems[selectedRowIndex];
        if (item?.id) {
          showApprovalFeedback(item.id);
          approveItem(item.id);
        }
      } else if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
        e.preventDefault();
        const item = paginatedItems[selectedRowIndex];
        if (item) {
          const rowId = item.id || `row-${selectedRowIndex}`;
          startEditing(rowId, 'artista_encontrado', item.artista_encontrado);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingCell, paginatedItems, selectedRowIndex, approveItem, showApprovalFeedback]);

  useEffect(() => {
    if (isKeyboardMode && tableContainerRef.current) {
      const selectedRow = tableContainerRef.current.querySelector(`[data-row-index="${selectedRowIndex}"]`);
      if (selectedRow) {
        selectedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedRowIndex, isKeyboardMode]);

  const handleApproveSelected = () => {
    if (selectedIds.length > 0) {
      selectedIds.forEach(id => showApprovalFeedback(id));
      approveMultiple(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleApproveAll = () => {
    const ids = paginatedItems.map(i => i.id || '').filter(id => id);
    approveMultiple(ids);
  };

  const handleRowClick = (index: number) => {
    setSelectedRowIndex(index);
    setIsKeyboardMode(false);
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
      return 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/20';
    }
    if (item.status_pesquisa === 'Sucesso') {
      return 'bg-green-50/50 hover:bg-green-100/50 dark:bg-green-950/10';
    }
    return 'bg-red-50/30 hover:bg-red-100/30 dark:bg-red-950/10';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              Revisão de Metadados
              {isKeyboardMode && (
                <Badge variant="outline" className="animate-pulse text-xs">
                  ⌨️ Modo Teclado
                </Badge>
              )}
            </CardTitle>
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
        <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <kbd className="px-2 py-1 text-xs bg-background rounded border">⌨️</kbd>
            Atalhos de Teclado
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div><kbd className="px-1.5 py-0.5 bg-background rounded">↑↓</kbd> Navegar</div>
            <div><kbd className="px-1.5 py-0.5 bg-background rounded">A</kbd> Aprovar</div>
            <div><kbd className="px-1.5 py-0.5 bg-background rounded">E</kbd> ou <kbd className="px-1.5 py-0.5 bg-background rounded">Enter</kbd> Editar</div>
            <div><kbd className="px-1.5 py-0.5 bg-background rounded">Esc</kbd> Cancelar</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] rounded-md border" ref={tableContainerRef}>
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.length === paginatedItems.length && paginatedItems.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[25%]">Título</TableHead>
                <TableHead className="w-[18%]">Artista</TableHead>
                <TableHead className="w-[18%]">Compositor</TableHead>
                <TableHead className="w-[10%]">Ano</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[12%]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? `Nenhum resultado para "${searchTerm}"` : 'Nenhuma música para revisar'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item, index) => {
                  const rowId = item.id || `row-${index}`;
                  return (
                    <TableRow 
                      key={rowId} 
                      data-row-index={index}
                      className={cn(
                        getRowHighlight(item),
                        isKeyboardMode && selectedRowIndex === index && "ring-2 ring-primary ring-offset-2",
                        feedbackAnimations[rowId] && "animate-pulse bg-green-100 dark:bg-green-950/30 transition-colors duration-300"
                      )}
                      onClick={() => handleRowClick(index)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(rowId)}
                          onCheckedChange={() => toggleSelection(rowId)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{item.titulo_original}</TableCell>

                      {/* Artista - Editável */}
                      <TableCell>
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
                              "flex items-center gap-2 group cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1",
                              item.artista_encontrado === 'Não Identificado' && "bg-yellow-100 dark:bg-yellow-950/30"
                            )}
                            onClick={() => startEditing(rowId, 'artista_encontrado', item.artista_encontrado)}
                          >
                            <span>{item.artista_encontrado}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      {/* Compositor - Editável */}
                      <TableCell>
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
                              "flex items-center gap-2 group cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1",
                              item.compositor_encontrado === 'Não Identificado' && "bg-yellow-100 dark:bg-yellow-950/30"
                            )}
                            onClick={() => startEditing(rowId, 'compositor_encontrado', item.compositor_encontrado)}
                          >
                            <span>{item.compositor_encontrado}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      {/* Ano - Editável */}
                      <TableCell>
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
                              "flex items-center gap-2 group cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1",
                              item.ano_lancamento === '0000' && "bg-yellow-100 dark:bg-yellow-950/30"
                            )}
                            onClick={() => startEditing(rowId, 'ano_lancamento', item.ano_lancamento === '0000' ? '' : item.ano_lancamento)}
                          >
                            <span>{item.ano_lancamento === '0000' ? '-' : item.ano_lancamento}</span>
                            <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </div>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {item.status_pesquisa === 'Sucesso' || item.status_pesquisa === 'Sucesso (Web)' ? (
                            <Badge variant="default" className="gap-1 bg-green-500/10 text-green-700 border-green-500/20">
                              <CheckCircle2 className="w-3 h-3" />
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
                          {item.enriched_by_web && (
                            <Badge variant="secondary" className="gap-1 text-xs bg-blue-500/10 text-blue-700 border-blue-500/20">
                              <Search className="w-3 h-3" />
                              Web
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => {
                            showApprovalFeedback(rowId);
                            approveItem(rowId);
                          }}
                          className="gap-1 transition-all hover:scale-105 active:scale-95"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Aprovar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>

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

const ApprovedTable = ({ items }: { items: EnrichedMusicData[] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Músicas Aprovadas</CardTitle>
            <CardDescription className="mt-1">
              {items.length} músicas prontas para exportação
            </CardDescription>
          </div>
          <AdvancedExportMenu data={items} />
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
        <ScrollArea className="h-[600px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[30%]">Título</TableHead>
                <TableHead className="w-[20%]">Artista</TableHead>
                <TableHead className="w-[20%]">Compositor</TableHead>
                <TableHead className="w-[10%]">Ano</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[10%]">Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchTerm ? `Nenhum resultado para "${searchTerm}"` : 'Nenhuma música aprovada ainda'}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((item, index) => (
                  <TableRow key={item.id || `row-${index}`} className="bg-green-50/30 dark:bg-green-950/10">
                    <TableCell className="font-medium">{item.titulo_original}</TableCell>
                    <TableCell>{item.artista_encontrado}</TableCell>
                    <TableCell>{item.compositor_encontrado}</TableCell>
                    <TableCell>{item.ano_lancamento === '0000' ? '-' : item.ano_lancamento}</TableCell>
                    <TableCell>
                      <Badge variant="default" className="gap-1 bg-green-500/10 text-green-700 border-green-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Aprovado
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {item.observacoes || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

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
