import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, FileJson, FileSpreadsheet, FileText } from 'lucide-react';
import { EnrichedMusicData } from '@/lib/batchProcessor';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface AdvancedExportMenuProps {
  data: EnrichedMusicData[];
}

type ExportFormat = 'csv' | 'json' | 'xlsx';

interface ExportColumn {
  key: keyof EnrichedMusicData;
  label: string;
  default: boolean;
}

const AVAILABLE_COLUMNS: ExportColumn[] = [
  { key: 'titulo_original', label: 'Título Original', default: true },
  { key: 'artista_encontrado', label: 'Artista Encontrado', default: true },
  { key: 'compositor_encontrado', label: 'Compositor Encontrado', default: true },
  { key: 'ano_lancamento', label: 'Ano de Lançamento', default: true },
  { key: 'status_pesquisa', label: 'Status de Pesquisa', default: true },
  { key: 'observacoes', label: 'Observações', default: false },
  { key: 'enriched_by_web', label: 'Enriquecido por Web', default: false },
];

export const AdvancedExportMenu = ({ data }: AdvancedExportMenuProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('xlsx');
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    AVAILABLE_COLUMNS.filter(col => col.default).map(col => col.key)
  );

  const toggleColumn = (columnKey: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnKey)
        ? prev.filter(k => k !== columnKey)
        : [...prev, columnKey]
    );
  };

  const selectAllColumns = () => {
    setSelectedColumns(AVAILABLE_COLUMNS.map(col => col.key));
  };

  const deselectAllColumns = () => {
    setSelectedColumns([]);
  };

  const handleExport = () => {
    if (selectedColumns.length === 0) {
      toast.error('Selecione pelo menos uma coluna para exportar.');
      return;
    }

    try {
      const filteredData = data.map(item => {
        const filtered: any = {};
        selectedColumns.forEach(colKey => {
          const column = AVAILABLE_COLUMNS.find(c => c.key === colKey);
          if (column) {
            filtered[column.label] = item[colKey as keyof EnrichedMusicData] || '';
          }
        });
        return filtered;
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `musicas_aprovadas_${timestamp}`;

      if (selectedFormat === 'json') {
        exportJSON(filteredData, filename);
      } else if (selectedFormat === 'csv') {
        exportCSV(filteredData, filename);
      } else if (selectedFormat === 'xlsx') {
        exportXLSX(filteredData, filename);
      }

      toast.success(`Exportação concluída! ${data.length} músicas exportadas.`);
      setDialogOpen(false);
    } catch (error) {
      console.error('[Export] Erro ao exportar:', error);
      toast.error('Erro ao exportar dados. Tente novamente.');
    }
  };

  const exportJSON = (data: any[], filename: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `${filename}.json`);
  };

  const exportCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(';'),
      ...data.map(row =>
        headers.map(header => {
          const value = String(row[header] || '');
          return value.includes(';') || value.includes(',') || value.includes('\n')
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(';')
      )
    ];

    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);
  };

  const exportXLSX = (data: any[], filename: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Músicas Aprovadas');

    const columns = Object.keys(data[0] || {});
    worksheet['!cols'] = columns.map(() => ({ wch: 20 }));

    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2">
            <Download className="w-4 h-4" />
            Exportar ({data.length})
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Formato de Exportação</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              setSelectedFormat('xlsx');
              setDialogOpen(true);
            }}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel (.xlsx)
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              setSelectedFormat('csv');
              setDialogOpen(true);
            }}
          >
            <FileText className="w-4 h-4" />
            CSV (.csv)
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              setSelectedFormat('json');
              setDialogOpen(true);
            }}
          >
            <FileJson className="w-4 h-4" />
            JSON (.json)
          </Button>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar Exportação</DialogTitle>
            <DialogDescription>
              Selecione as colunas que deseja incluir no arquivo {selectedFormat.toUpperCase()}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllColumns}>
                Selecionar Todas
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllColumns}>
                Desmarcar Todas
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-4 border rounded-lg">
              {AVAILABLE_COLUMNS.map(column => (
                <div key={column.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={column.key}
                    checked={selectedColumns.includes(column.key)}
                    onCheckedChange={() => toggleColumn(column.key)}
                  />
                  <Label
                    htmlFor={column.key}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {column.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Resumo da Exportação:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Formato: {selectedFormat.toUpperCase()}</li>
                <li>Músicas: {data.length}</li>
                <li>Colunas: {selectedColumns.length} selecionadas</li>
              </ul>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExport} disabled={selectedColumns.length === 0}>
              Exportar {selectedFormat.toUpperCase()}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
