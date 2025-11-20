import React, { useState, useMemo } from 'react';
import { EnrichedMusicData } from '../lib/batchProcessor';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Search, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';

interface EnrichedDataTableProps {
  data: EnrichedMusicData[];
  isLoading?: boolean;
}

const ITEMS_PER_PAGE = 50;

const EnrichedDataTable = ({ data, isLoading = false }: EnrichedDataTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');

  // Filtragem e busca
  const filteredData = useMemo(() => {
    let filtered = data;

    // Filtro por status
    if (statusFilter === 'success') {
      filtered = filtered.filter(item => item.status_pesquisa === 'Sucesso');
    } else if (statusFilter === 'failure') {
      filtered = filtered.filter(item => item.status_pesquisa === 'Falha');
    }

    // Busca por texto
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.titulo_original.toLowerCase().includes(term) ||
        item.artista_encontrado.toLowerCase().includes(term) ||
        item.compositor_encontrado.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [data, searchTerm, statusFilter]);

  // Paginação
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  // Estatísticas
  const stats = useMemo(() => {
    const successCount = data.filter(d => d.status_pesquisa === 'Sucesso').length;
    const failureCount = data.filter(d => d.status_pesquisa === 'Falha').length;
    return { total: data.length, successCount, failureCount };
  }, [data]);

  // Reset para primeira página quando filtros mudam
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const getStatusBadge = (status: string) => {
    if (status === 'Sucesso') {
      return (
        <Badge variant="default" className="gap-1 bg-green-500/10 text-green-700 border-green-500/20 hover:bg-green-500/20">
          <CheckCircle2 className="w-3 h-3" />
          Sucesso
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="w-3 h-3" />
        Falha
      </Badge>
    );
  };

  if (data.length === 0 && !isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Nenhum dado enriquecido disponível ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Dados Enriquecidos</CardTitle>
            <CardDescription className="mt-1">
              {stats.total.toLocaleString()} músicas processadas • {stats.successCount.toLocaleString()} sucessos • {stats.failureCount.toLocaleString()} falhas
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={statusFilter === 'success' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('success')}
              className={statusFilter === 'success' ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              Sucessos
            </Button>
            <Button
              variant={statusFilter === 'failure' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('failure')}
            >
              Falhas
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
        <ScrollArea className="h-[600px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[30%]">Título Original</TableHead>
                <TableHead className="w-[20%]">Artista</TableHead>
                <TableHead className="w-[20%]">Compositor</TableHead>
                <TableHead className="w-[10%]">Ano</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[10%]">Observações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando dados...
                  </TableCell>
                </TableRow>
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum resultado encontrado para "{searchTerm}"
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((item, index) => (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-medium">{item.titulo_original}</TableCell>
                    <TableCell>{item.artista_encontrado}</TableCell>
                    <TableCell>{item.compositor_encontrado}</TableCell>
                    <TableCell>{item.ano_lancamento === '0000' ? '-' : item.ano_lancamento}</TableCell>
                    <TableCell>{getStatusBadge(item.status_pesquisa)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {item.observacoes || '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} de {filteredData.length.toLocaleString()} resultados
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2 px-3 py-1 text-sm">
                Página {currentPage} de {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnrichedDataTable;
