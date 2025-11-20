import React, { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, FileSpreadsheet } from 'lucide-react';

export interface ColumnMap {
  tituloIndex: number;
  artistaIndex: number;
  compositorIndex: number;
  anoIndex: number;
  hasHeader: boolean;
}

interface ColumnMapperProps {
  filename: string;
  rawRows: any[][];
  onConfirm: (map: ColumnMap) => void;
  onCancel: () => void;
}

const ColumnMapper: React.FC<ColumnMapperProps> = ({ filename, rawRows, onConfirm, onCancel }) => {
  const [hasHeader, setHasHeader] = useState(false);
  const [tituloCol, setTituloCol] = useState<string>("");
  const [artistaCol, setArtistaCol] = useState<string>("-1");
  const [compositorCol, setCompositorCol] = useState<string>("-1");
  const [anoCol, setAnoCol] = useState<string>("-1");

  // Gera letras de colunas (A, B, C...) baseadas no número de colunas da primeira linha
  const numCols = rawRows.length > 0 ? rawRows[0].length : 0;
  const columns = Array.from({ length: numCols }, (_, i) => ({
    index: i,
    label: `Coluna ${String.fromCharCode(65 + i)}` // A, B, C...
  }));

  // Tenta adivinhar o mapeamento inicial
  useEffect(() => {
    if (rawRows.length === 0) return;
    const firstRow = rawRows[0].map(cell => String(cell || '').toLowerCase());
    
    // Lógica simples de auto-detecção para sugestão
    firstRow.forEach((cell, idx) => {
      if (cell.includes('música') || cell.includes('titulo') || cell.includes('nome')) {
        setTituloCol(String(idx));
        setHasHeader(true);
      }
      if (cell.includes('artista') || cell.includes('cantor') || cell.includes('intérprete')) {
        setArtistaCol(String(idx));
        setHasHeader(true);
      }
      if (cell.includes('compositor') || cell.includes('autor')) {
        setCompositorCol(String(idx));
        setHasHeader(true);
      }
      if (cell.includes('ano') || cell.includes('lançamento')) {
        setAnoCol(String(idx));
        setHasHeader(true);
      }
    });
  }, [rawRows]);

  const handleConfirm = () => {
    onConfirm({
      tituloIndex: parseInt(tituloCol),
      artistaIndex: parseInt(artistaCol),
      compositorIndex: parseInt(compositorCol),
      anoIndex: parseInt(anoCol),
      hasHeader
    });
  };

  // Dados para preview (pula a primeira linha se for cabeçalho)
  const previewRows = hasHeader ? rawRows.slice(1, 6) : rawRows.slice(0, 5);

  return (
    <Card className="w-full max-w-5xl mx-auto border-2 border-primary/20 shadow-lg animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="bg-muted/30 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Mapeamento de Colunas</CardTitle>
            <CardDescription>
              O arquivo <strong>{filename}</strong> precisa de ajuda para ser entendido. Indique o que cada coluna representa.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-8">
        {/* Controles de Mapeamento */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            <Label className="text-primary font-semibold">Título da Música <span className="text-destructive">*</span></Label>
            <Select value={tituloCol} onValueChange={setTituloCol}>
              <SelectTrigger className="border-primary/30 focus:ring-primary bg-background">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {columns.map(col => (
                  <SelectItem key={col.index} value={String(col.index)}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Onde está o nome da música?</p>
          </div>

          <div className="space-y-2">
            <Label>Artista / Intérprete</Label>
            <Select value={artistaCol} onValueChange={setArtistaCol}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="(Opcional)" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="-1">Não existe no arquivo</SelectItem>
                {columns.map(col => (
                  <SelectItem key={col.index} value={String(col.index)}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Compositor</Label>
            <Select value={compositorCol} onValueChange={setCompositorCol}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="(Opcional)" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="-1">Não existe no arquivo</SelectItem>
                {columns.map(col => (
                  <SelectItem key={col.index} value={String(col.index)}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ano de Lançamento</Label>
            <Select value={anoCol} onValueChange={setAnoCol}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="(Opcional)" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="-1">Não existe no arquivo</SelectItem>
                {columns.map(col => (
                  <SelectItem key={col.index} value={String(col.index)}>{col.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2 py-2">
          <Checkbox 
            id="header-check" 
            checked={hasHeader} 
            onCheckedChange={(c) => setHasHeader(!!c)} 
          />
          <Label htmlFor="header-check" className="cursor-pointer">
            A primeira linha do arquivo contém cabeçalhos (ex: "Nome", "Artista")?
          </Label>
        </div>

        {/* Preview da Tabela */}
        <div className="rounded-md border bg-background/50 overflow-hidden">
          <div className="bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
            Pré-visualização dos dados (baseado na sua seleção)
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(col => (
                  <TableHead key={col.index} className={
                    col.index === parseInt(tituloCol) ? "bg-primary/10 text-primary font-bold" :
                    col.index === parseInt(artistaCol) ? "bg-blue-500/10 text-blue-600 font-semibold" : ""
                  }>
                    {col.label}
                    {col.index === parseInt(tituloCol) && " (Música)"}
                    {col.index === parseInt(artistaCol) && " (Artista)"}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, rIdx) => (
                <TableRow key={rIdx}>
                  {row.map((cell: any, cIdx: number) => (
                    <TableCell key={cIdx} className="truncate max-w-[200px]">
                      {String(cell || '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!tituloCol || tituloCol === ""}
            className="gap-2"
          >
            Confirmar Mapeamento <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ColumnMapper;
