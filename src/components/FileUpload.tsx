import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  isProcessing: boolean;
  selectedFiles: File[];
  onRemoveFile: (index: number) => void;
}

export const FileUpload = ({ onFilesSelect, isProcessing, selectedFiles, onRemoveFile }: FileUploadProps) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      onFilesSelect(Array.from(files));
    }
  };

  return (
    <Card className="p-8 border-2 border-dashed border-border hover:border-primary transition-colors">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Upload de Arquivos XLSX</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Selecione um ou mais arquivos Excel (.xlsx) para processar
          </p>
          <label htmlFor="file-upload">
            <Button disabled={isProcessing} asChild>
              <span className="cursor-pointer">
                {isProcessing ? "Processando..." : "Selecionar Arquivos"}
              </span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={handleFileChange}
            className="hidden"
            disabled={isProcessing}
          />
        </div>

        {selectedFiles.length > 0 && (
          <div className="w-full mt-4 space-y-2">
            <p className="text-sm font-medium">Arquivos Selecionados ({selectedFiles.length}):</p>
            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onRemoveFile(index)}
                    disabled={isProcessing}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
