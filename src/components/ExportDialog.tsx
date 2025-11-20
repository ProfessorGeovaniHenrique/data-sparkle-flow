import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ExportOptions) => void;
}

export interface ExportOptions {
  format: 'csv' | 'xlsx';
  delimiter: ',' | ';';
  encoding: 'utf8' | 'utf8-bom';
}

export const ExportDialog = ({ open, onOpenChange, onExport }: ExportDialogProps) => {
  const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
  const [delimiter, setDelimiter] = useState<',' | ';'>(';');
  const [encoding, setEncoding] = useState<'utf8' | 'utf8-bom'>('utf8-bom');
  
  const handleExport = () => {
    onExport({
      format,
      delimiter,
      encoding
    });
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar Exportação CSV</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Delimitador</Label>
            <RadioGroup value={delimiter} onValueChange={(value: any) => setDelimiter(value)}>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="semicolon"
                  value=";"
                  checked={delimiter === ';'}
                  onChange={(e) => setDelimiter(e.target.value as any)}
                  className="w-4 h-4"
                />
                <Label htmlFor="semicolon" className="font-normal cursor-pointer">
                  Ponto e vírgula (;) - Recomendado para Excel
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="comma"
                  value=","
                  checked={delimiter === ','}
                  onChange={(e) => setDelimiter(e.target.value as any)}
                  className="w-4 h-4"
                />
                <Label htmlFor="comma" className="font-normal cursor-pointer">
                  Vírgula (,) - Padrão CSV
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-3">
            <Label>Codificação</Label>
            <RadioGroup value={encoding} onValueChange={(value: any) => setEncoding(value)}>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="utf8-bom"
                  value="utf8-bom"
                  checked={encoding === 'utf8-bom'}
                  onChange={(e) => setEncoding(e.target.value as any)}
                  className="w-4 h-4"
                />
                <Label htmlFor="utf8-bom" className="font-normal cursor-pointer">
                  UTF-8 com BOM - Compatível com Excel antigo
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="utf8"
                  value="utf8"
                  checked={encoding === 'utf8'}
                  onChange={(e) => setEncoding(e.target.value as any)}
                  className="w-4 h-4"
                />
                <Label htmlFor="utf8" className="font-normal cursor-pointer">
                  UTF-8 padrão
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg text-sm">
            <p className="font-medium mb-1">Colunas do CSV:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Título da Música</li>
              <li>Nome do Artista</li>
              <li>Nome do Compositor</li>
              <li>Ano de Lançamento</li>
              <li>Status do Processamento</li>
            </ul>
          </div>
        </div>
        
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleExport}>
            Exportar CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
