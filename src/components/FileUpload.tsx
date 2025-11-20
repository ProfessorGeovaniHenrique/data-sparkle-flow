import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { parseExcelFile, ParseResult } from '@/lib/excelParser';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FileUploadProps {
  onFilesSelect: (files: File[], parsedData: ParseResult[]) => void;
  isProcessing: boolean;
}

export const FileUpload = ({ onFilesSelect, isProcessing }: FileUploadProps) => {
  const [isParsing, setIsParsing] = useState(false);
  const [parseResults, setParseResults] = useState<ParseResult[]>([]);
  const [rawFiles, setRawFiles] = useState<File[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsParsing(true);
    setRawFiles(acceptedFiles);
    const results: ParseResult[] = [];
    let hasError = false;

    try {
      for (const file of acceptedFiles) {
        try {
          toast.info(`Lendo arquivo: ${file.name}...`);
          const result = await parseExcelFile(file);
          results.push(result);
          toast.success(`${file.name}: ${result.totalRows} músicas encontradas.`);
        } catch (error: any) {
          console.error(`Erro ao ler ${file.name}:`, error);
          toast.error(`Falha ao ler ${file.name}: ${error.message}`);
          hasError = true;
        }
      }
    } finally {
      setIsParsing(false);
      if (!hasError && results.length > 0) {
        setParseResults(results);
      } else {
        setRawFiles([]);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    disabled: isProcessing || isParsing,
    multiple: true
  });

  const handleConfirm = () => {
    onFilesSelect(rawFiles, parseResults);
    setParseResults([]);
    setRawFiles([]);
  };

  const handleCancel = () => {
    setParseResults([]);
    setRawFiles([]);
    toast.info("Seleção de arquivos cancelada.");
  };

  if (parseResults.length > 0) {
    const totalMusicas = parseResults.reduce((acc, curr) => acc + curr.totalRows, 0);
    const previewData = parseResults[0].extractedData.slice(0, 5);

    return (
      <div className="w-full p-6 border-2 border-primary/20 rounded-xl bg-background/50 backdrop-blur-sm animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Análise Concluída</h3>
              <p className="text-sm text-muted-foreground">
                {parseResults.length} arquivo(s) | Total de {totalMusicas.toLocaleString()} músicas detectadas.
              </p>
            </div>
          </div>
          {parseResults.every(r => r.columnsDetected.musica) ? (
            <CheckCircle className="w-6 h-6 text-green-500" />
          ) : (
            <AlertCircle className="w-6 h-6 text-yellow-500" />
          )}
        </div>

        <div className="mb-4 p-4 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Preview do arquivo: {parseResults[0].filename}
          </h4>
          <ScrollArea className="h-[150px] w-full rounded-md border p-2">
            <ul className="space-y-1 text-sm">
              {previewData.map((item, idx) => (
                <li key={item.id} className="flex items-center gap-2 py-1 border-b last:border-0 border-border/50">
                  <span className="text-muted-foreground w-6">{idx + 1}.</span>
                  <span className="font-medium truncate">{item.titulo}</span>
                  {item.artista && <span className="text-xs text-muted-foreground">- {item.artista}</span>}
                </li>
              ))}
              {parseResults[0].totalRows > 5 && (
                <li className="text-xs text-muted-foreground pt-2">
                  ...e mais {parseResults[0].totalRows - 5} músicas neste arquivo.
                </li>
              )}
            </ul>
          </ScrollArea>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing}>
            Confirmar e Processar {totalMusicas.toLocaleString()} Músicas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`
        w-full p-12 border-2 border-dashed rounded-xl text-center cursor-pointer
        transition-all duration-300 ease-in-out
        ${isDragActive ? 'border-primary bg-primary/5 scale-[0.99]' : 'border-border hover:border-primary/50 hover:bg-muted/20'}
        ${(isProcessing || isParsing) ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4">
        <div className={`p-4 rounded-full bg-primary/10 transition-transform duration-300 ${isDragActive ? 'scale-110' : ''}`}>
          {isParsing ? (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          ) : (
            <Upload className="w-8 h-8 text-primary" />
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-1">
            {isParsing ? "Lendo arquivos..." : "Arraste suas planilhas aqui"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            {isParsing
              ? "Processando dados no seu navegador, aguarde..."
              : "Ou clique para selecionar arquivos .xlsx ou .xls. O processamento inicial é feito no seu computador."}
          </p>
        </div>
      </div>
    </div>
  );
};
