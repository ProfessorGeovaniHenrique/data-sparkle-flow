import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Download } from "lucide-react";
import { useState } from "react";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (options: ExportOptions) => void;
}

export interface ExportOptions {
  filter: 'all' | 'validated' | 'validated_and_rejected';
  includeOriginal: boolean;
  multipleSheets: boolean;
}

export const ExportDialog = ({ open, onOpenChange, onExport }: ExportDialogProps) => {
  const [filter, setFilter] = useState<'all' | 'validated' | 'validated_and_rejected'>('validated');
  const [includeOriginal, setIncludeOriginal] = useState(false);
  const [multipleSheets, setMultipleSheets] = useState(true);
  
  const handleExport = () => {
    onExport({
      filter,
      includeOriginal,
      multipleSheets,
    });
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Opções de Exportação</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Quais registros exportar?</Label>
            <RadioGroup value={filter} onValueChange={(v) => setFilter(v as any)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="validated" id="validated" />
                <Label htmlFor="validated" className="font-normal">
                  Apenas aprovados
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="validated_and_rejected" id="validated_and_rejected" />
                <Label htmlFor="validated_and_rejected" className="font-normal">
                  Aprovados e rejeitados
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal">
                  Todos (incluindo pendentes)
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-3">
            <Label>Formato do arquivo</Label>
            <RadioGroup value={multipleSheets ? 'multiple' : 'single'} onValueChange={(v) => setMultipleSheets(v === 'multiple')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multiple" id="multiple" />
                <Label htmlFor="multiple" className="font-normal">
                  Múltiplas abas (Aprovados, Rejeitados, Todos)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="single" />
                <Label htmlFor="single" className="font-normal">
                  Aba única
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-3">
            <Label>Dados originais</Label>
            <RadioGroup value={includeOriginal ? 'yes' : 'no'} onValueChange={(v) => setIncludeOriginal(v === 'yes')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="yes" />
                <Label htmlFor="yes" className="font-normal">
                  Incluir dados originais (antes da limpeza)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="no" />
                <Label htmlFor="no" className="font-normal">
                  Apenas dados processados e enriquecidos
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
