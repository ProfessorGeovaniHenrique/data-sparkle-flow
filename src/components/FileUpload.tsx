import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { parseExcelFile, ParseResult, parseExcelRaw, extractDataFromMap, RawParseResult, cleanScraperData } from '@/lib/excelParser';
import { deduplicateMusicData } from '@/lib/deduplication';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import ColumnMapper, { ColumnMap } from '@/components/ColumnMapper';
import { ProcessingLog } from '@/components/ProcessingLog';

interface FileUploadProps {
  onFilesSelect: (files: File[], parsedData: ParseResult[]) => void;
  isProcessing: boolean;
}

export const FileUpload = ({ onFilesSelect, isProcessing }: FileUploadProps) => {
  const [isParsing, setIsParsing] = useState(false);
  const [parseResults, setParseResults] = useState<ParseResult[]>([]);
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [needsMapping, setNeedsMapping] = useState(false);
  const [rawParseData, setRawParseData] = useState<RawParseResult | null>(null);
  
  // Novos estados para deduplicação
  const [showDeduplicationPreview, setShowDeduplicationPreview] = useState(false);
  const [preDedupeData, setPreDedupeData] = useState<ParseResult[] | null>(null);
  const [deduplicationStats, setDeduplicationStats] = useState<{
    totalOriginal: number;
    duplicatesRemoved: number;
    uniqueCount: number;
  } | null>(null);
  
  // Estado para logs de processamento
  const [processingLogs, setProcessingLogs] = useState<string[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsParsing(true);
    setRawFiles(acceptedFiles);
    clearLogs();
    addLog(`📁 ${acceptedFiles.length} arquivo(s) selecionado(s).`);
    const results: ParseResult[] = [];
    let hasError = false;

    try {
      for (const file of acceptedFiles) {
        try {
          toast.info(`Lendo arquivo: ${file.name}...`);
          const result = await parseExcelFile(file);
          
          // Verifica confiança da detecção
          if (result.detectionConfidence === 'low') {
            // Baixa confiança: pede mapeamento manual
            toast.warning("Não foi possível identificar as colunas automaticamente. Por favor, mapeie-as manualmente.");
            const rawData = await parseExcelRaw(file);
            setRawParseData(rawData);
            setNeedsMapping(true);
            setIsParsing(false);
            return; // Para aqui e mostra o mapper
          } else {
            // Alta confiança: prossegue normalmente
            
            // Validação: se nenhum dado foi extraído
            if (result.extractedData.length === 0) {
              toast.error(`${file.name}: Nenhuma música foi extraída. Verifique o formato do arquivo.`);
              hasError = true;
            } else {
              results.push(result);
              toast.success(`${file.name}: ${result.totalRows} músicas encontradas.`);
            }
          }
        } catch (error: any) {
          console.error(`Erro ao ler ${file.name}:`, error);
          toast.error(`Falha ao ler ${file.name}: ${error.message}`);
          hasError = true;
        }
      }
    } finally {
      setIsParsing(false);
      if (!hasError && results.length > 0) {
        // Em vez de setar parseResults diretamente, faz deduplicação primeiro
        checkForDuplicates(results);
      } else if (!needsMapping) {
        setRawFiles([]);
      }
    }
  }, [needsMapping]);

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
    setNeedsMapping(false);
    setRawParseData(null);
    clearLogs();
    toast.info("Seleção de arquivos cancelada.");
  };

  const handleMappingConfirm = async (map: ColumnMap) => {
    if (!rawParseData || rawFiles.length === 0) return;
    
    try {
      toast.info("Aplicando mapeamento...");
      const result = await extractDataFromMap(rawFiles[0], map);
      
      // Log de debug: Resultado do mapeamento
      console.log('[FileUpload] Resultado do mapeamento:', result.extractedData.length, 'músicas');
      
      // Validação: se nenhum dado foi extraído
      if (result.extractedData.length === 0) {
        toast.error("Nenhuma música foi extraída do arquivo. Verifique o formato e o mapeamento.");
        return;
      }
      
      // Em vez de setar parseResults diretamente, verifica duplicatas
      checkForDuplicates([result]);
      setNeedsMapping(false);
      setRawParseData(null);
      toast.success(`${result.totalRows} músicas extraídas com sucesso!`);
    } catch (error: any) {
      toast.error(`Erro ao processar: ${error.message}`);
    }
  };

  const handleMappingCancel = () => {
    setNeedsMapping(false);
    setRawParseData(null);
    setRawFiles([]);
    toast.info("Mapeamento cancelado.");
  };

  const addLog = (message: string) => {
    setProcessingLogs(prev => [...prev, message]);
  };

  const clearLogs = () => {
    setProcessingLogs([]);
  };

  const checkForDuplicates = (results: ParseResult[]) => {
    addLog('Iniciando verificação de duplicatas...');
    
    // Concatena todos os dados extraídos de todos os arquivos
    let allMusic = results.flatMap(r => r.extractedData);
    addLog(`Total de ${allMusic.length} linhas lidas.`);
    
    // ETAPA 1: Limpeza de scraper (fusão de linhas consecutivas)
    addLog('Executando limpeza de scraper (fusão de duplicatas consecutivas)...');
    allMusic = cleanScraperData(allMusic, addLog);
    
    // ETAPA 2: Deduplicação global
    addLog('Executando deduplicação global...');
    const dedupeResult = deduplicateMusicData(allMusic);
    
    if (dedupeResult.duplicatesRemoved > 0) {
      // Duplicatas encontradas: mostra preview de limpeza
      console.log('[FileUpload] Duplicatas detectadas:', dedupeResult.duplicatesRemoved);
      addLog(`⚠️ ${dedupeResult.duplicatesRemoved} duplicatas adicionais encontradas.`);
      
      // Atualiza results com dados limpos
      const cleanedResult: ParseResult = {
        ...results[0],
        totalRows: allMusic.length,
        extractedData: allMusic
      };
      
      setPreDedupeData([cleanedResult]);
      setDeduplicationStats({
        totalOriginal: dedupeResult.totalOriginal,
        duplicatesRemoved: dedupeResult.duplicatesRemoved,
        uniqueCount: dedupeResult.unique.length
      });
      setShowDeduplicationPreview(true);
      toast.info(`${dedupeResult.duplicatesRemoved} duplicatas encontradas. Revise antes de prosseguir.`);
    } else {
      // Sem duplicatas: segue fluxo normal
      console.log('[FileUpload] Nenhuma duplicata encontrada');
      addLog('✓ Nenhuma duplicata adicional encontrada.');
      addLog(`Processamento concluído! ${allMusic.length} músicas únicas prontas.`);
      
      // Atualiza results com dados limpos do scraper
      const cleanedResult: ParseResult = {
        ...results[0],
        totalRows: allMusic.length,
        extractedData: allMusic
      };
      
      setParseResults([cleanedResult]);
      toast.success("Limpeza concluída! Pronto para processar.");
    }
  };

  const handleApplyDeduplication = () => {
    if (!preDedupeData) return;
    
    // Aplica deduplicação
    const allMusic = preDedupeData.flatMap(r => r.extractedData);
    const dedupeResult = deduplicateMusicData(allMusic);
    
    // Cria novo ParseResult com dados limpos
    const cleanedResult: ParseResult = {
      filename: preDedupeData[0].filename,
      totalRows: dedupeResult.unique.length,
      extractedData: dedupeResult.unique,
      columnsDetected: preDedupeData[0].columnsDetected,
      detectionConfidence: preDedupeData[0].detectionConfidence
    };
    
    setParseResults([cleanedResult]);
    setShowDeduplicationPreview(false);
    setPreDedupeData(null);
    setDeduplicationStats(null);
    toast.success(`Limpeza aplicada! ${dedupeResult.duplicatesRemoved} duplicatas removidas.`);
  };

  const handleKeepDuplicates = () => {
    if (!preDedupeData) return;
    
    // Usa dados originais sem deduplicação
    setParseResults(preDedupeData);
    setShowDeduplicationPreview(false);
    setPreDedupeData(null);
    setDeduplicationStats(null);
    toast.info("Duplicatas mantidas. Todos os dados serão processados.");
  };

  // Se precisa de mapeamento, mostra o ColumnMapper
  if (needsMapping && rawParseData) {
    return (
      <ColumnMapper
        filename={rawParseData.filename}
        rawRows={rawParseData.rawRows}
        onConfirm={handleMappingConfirm}
        onCancel={handleMappingCancel}
      />
    );
  }

  // Preview de deduplicação (nova etapa intermediária)
  if (showDeduplicationPreview && deduplicationStats && preDedupeData) {
    return (
      <div className="w-full p-6 border-2 border-yellow-500/30 rounded-xl bg-background/50 backdrop-blur-sm animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
            <div>
              <h3 className="text-lg font-semibold">Duplicatas Detectadas</h3>
              <p className="text-sm text-muted-foreground">
                Encontramos linhas redundantes que precisam de revisão
              </p>
            </div>
          </div>
        </div>

        {/* Estatísticas de Limpeza */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="text-2xl font-bold text-blue-500">
              {deduplicationStats.totalOriginal.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Total de linhas lidas
            </div>
          </div>
          
          <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <div className="text-2xl font-bold text-yellow-500">
              {deduplicationStats.duplicatesRemoved.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Duplicatas encontradas
            </div>
          </div>
          
          <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <div className="text-2xl font-bold text-green-500">
              {deduplicationStats.uniqueCount.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Músicas únicas após limpeza
            </div>
          </div>
        </div>

        {/* Explicação */}
        <div className="mb-6 p-4 bg-muted/30 rounded-lg">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-500" /> O que são duplicatas?
          </h4>
          <p className="text-sm text-muted-foreground">
            Detectamos linhas redundantes para a mesma música (mesmo título + artista). 
            Isso é comum em dados de scraping. A limpeza automática mantém a versão 
            mais completa de cada música (com mais campos preenchidos).
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-3 justify-end">
          <Button 
            variant="outline" 
            onClick={handleKeepDuplicates}
            disabled={isProcessing}
          >
            Manter Duplicatas
          </Button>
          <Button 
            onClick={handleApplyDeduplication}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700"
          >
            Aplicar Limpeza ({deduplicationStats.uniqueCount.toLocaleString()} músicas)
          </Button>
        </div>
      </div>
    );
  }

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
    <>
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
      
      {/* Terminal de Logs */}
      <ProcessingLog logs={processingLogs} title="Log de Processamento" />
    </>
  );
};
