import { useState, useEffect } from "react";
import { FileUpload } from "@/components/FileUpload";
import { StatsCard } from "@/components/StatsCard";
import { ProcessingPipeline } from "@/components/ProcessingPipeline";
import { TitleExtractionResults } from "@/components/TitleExtractionResults";
import { EnrichmentProgress } from "@/components/EnrichmentProgress";
import { ProcessingControl } from "@/components/ProcessingControl";
import { ErrorLog } from "@/components/ErrorLog";
import { ValidationTable, EnrichedMusicItem } from "@/components/ValidationTable";
import { ExportDialog, ExportOptions } from "@/components/ExportDialog";
import { ProcessingProvider, useProcessing } from "@/contexts/ProcessingContext";
import { Database, Sparkles, CheckCircle, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";


const IndexContent = () => {
  const processing = useProcessing();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'extract' | 'enrich' | 'validate' | 'export'>('upload');
  
  const [extractionResults, setExtractionResults] = useState<{
    extractedTitles: any[];
    stats: any;
    files: any[];
  } | null>(null);
  
  const [enrichedData, setEnrichedData] = useState<EnrichedMusicItem[]>([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  const stats = {
    titlesFound: extractionResults?.stats.totalTitles || 0,
    titlesClean: extractionResults?.stats.uniqueTitles || 0,
    enriched: enrichedData.filter(d => d.status_pesquisa === 'Sucesso').length,
    failed: enrichedData.filter(d => d.status_pesquisa === 'Falha').length,
  };

  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  // Auto-save progress to localStorage
  useEffect(() => {
    if (processing.progress.current > 0) {
      localStorage.setItem('musicEnrichment', JSON.stringify({
        enrichedData,
        progress: processing.progress.current
      }));
    }
  }, [enrichedData, processing.progress.current]);

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
    toast.success(`${files.length} arquivo(s) adicionado(s)`);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    toast.info("Arquivo removido");
  };

  const handleExtractTitles = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Nenhum arquivo selecionado");
      return;
    }

    setIsExtracting(true);
    setCurrentStep('extract');
    processing.setStatus('extracting');
    
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-music-titles`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: formData
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      if (!result || !result.success) throw new Error('No result from extraction');

      setExtractionResults(result);
      processing.setSelectedTitles(result.extractedTitles.map((t: any) => t.titulo));
      setSelectedFiles([]);
      
      toast.success(`${result.stats.uniqueTitles} títulos únicos extraídos!`);
      setCurrentStep('enrich');
      processing.setStatus('idle');
    } catch (error: any) {
      toast.error("Erro ao extrair títulos: " + error.message);
      console.error(error);
      setCurrentStep('upload');
      processing.setStatus('idle');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleEnrichData = async (titlesToEnrich?: string[]) => {
    const titles = titlesToEnrich || processing.selectedTitles;
    
    if (titles.length === 0) {
      toast.error("Nenhum título selecionado para enriquecer");
      return;
    }

    processing.setStatus('enriching');
    setCurrentStep('enrich');
    processing.setProgress({ total: titles.length, current: 0, speed: 0, eta: 0 });
    setStartTime(Date.now());

    try {
      const batchSize = 5; // Reduced for better control
      let allEnriched: EnrichedMusicItem[] = [...enrichedData];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < titles.length; i += batchSize) {
        // Check if paused or cancelled
        if (processing.status === 'paused') {
          while (processing.status === 'paused') {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (processing.status === 'cancelled') {
          toast.info("Processamento cancelado");
          break;
        }

        const batch = titles.slice(i, i + batchSize);
        const batchStart = Date.now();
        
        const { data: result, error } = await supabase.functions.invoke('enrich-music-data', {
          body: { titles: batch }
        });

        if (error) {
          if (error.message.includes('429')) {
            toast.error("Limite de requisições atingido. Aguardando...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            i -= batchSize;
            continue;
          }
          if (error.message.includes('402')) {
            toast.error("Créditos insuficientes no Lovable AI.");
            break;
          }
          
          // Log errors
          batch.forEach(title => {
            processing.addError({
              item: title,
              error: error.message,
              timestamp: new Date()
            });
          });
          failureCount += batch.length;
          continue;
        }

        if (result?.enrichedData) {
          allEnriched = [...allEnriched, ...result.enrichedData];
          successCount += result.enrichedData.filter((d: any) => d.status_pesquisa === 'Sucesso').length;
          failureCount += result.enrichedData.filter((d: any) => d.status_pesquisa === 'Falha').length;
        }

        // Update progress
        const elapsed = (Date.now() - startTime) / 1000;
        const processed = Math.min(i + batchSize, titles.length);
        const speed = processed / elapsed;
        const eta = (titles.length - processed) / speed;

        processing.setProgress({
          current: processed,
          total: titles.length,
          speed,
          eta
        });

        // Auto-save every 10 songs
        if (processed % 10 === 0) {
          setEnrichedData(allEnriched);
        }
      }

      setEnrichedData(allEnriched);
      
      if (processing.status !== 'cancelled') {
        processing.setStatus('completed');
        toast.success(`${allEnriched.length} músicas processadas!`);
        setCurrentStep('validate');
      }
    } catch (error: any) {
      toast.error("Erro ao enriquecer dados: " + error.message);
      console.error(error);
      processing.setStatus('idle');
    }
  };

  const handleUpdateItem = (index: number, updatedItem: EnrichedMusicItem) => {
    const newData = [...enrichedData];
    newData[index] = updatedItem;
    setEnrichedData(newData);
    toast.success("Dados atualizados!");
  };

  const handleExportCSV = (options: ExportOptions) => {
    const delimiter = options.delimiter;
    const BOM = options.encoding === 'utf8-bom' ? '\uFEFF' : '';
    
    // CSV Header
    const header = `Título da Música${delimiter}Nome do Artista${delimiter}Nome do Compositor${delimiter}Ano de Lançamento${delimiter}Status do Processamento\n`;
    
    // CSV Rows
    const rows = enrichedData.map(item => {
      return `${item.titulo_original}${delimiter}${item.artista_encontrado}${delimiter}${item.compositor_encontrado}${delimiter}${item.ano_lancamento}${delimiter}${item.status_pesquisa}`;
    }).join('\n');
    
    const csvContent = BOM + header + rows;
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'musicas_enriquecidas.csv';
    link.click();
    
    toast.success("CSV exportado com sucesso!");
  };

  const handleReset = () => {
    setShowResetDialog(true);
  };

  const confirmReset = () => {
    setExtractionResults(null);
    setEnrichedData([]);
    setCurrentStep('upload');
    setSelectedFiles([]);
    processing.reset();
    localStorage.removeItem('musicEnrichment');
    toast.success("Dados resetados!");
    setShowResetDialog(false);
  };

  const handleCancelProcess = () => {
    if (processing.status === 'enriching') {
      setShowCancelDialog(true);
    }
  };

  const confirmCancel = () => {
    processing.cancel();
    setShowCancelDialog(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Sistema de Enriquecimento de Dados Musicais</h1>
            <p className="text-muted-foreground">
              Extração automática, enriquecimento via IA e exportação CSV
            </p>
          </div>
        </div>

        <ProcessingPipeline currentStep={currentStep} />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard title="Títulos Encontrados" value={stats.titlesFound} icon={FileText} />
          <StatsCard title="Títulos Únicos" value={stats.titlesClean} icon={CheckCircle} variant="success" />
          <StatsCard title="Enriquecidos" value={stats.enriched} icon={Sparkles} variant="enriched" />
          <StatsCard title="Falhas" value={stats.failed} icon={Database} variant="destructive" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <ProcessingControl />
            <ErrorLog onRetry={handleEnrichData} />
          </div>
          
          <div className="lg:col-span-2 space-y-6">
            {currentStep === 'upload' && (
              <>
                <FileUpload
                  onFilesSelect={handleFilesSelect}
                  isProcessing={isExtracting}
                  selectedFiles={selectedFiles}
                  onRemoveFile={handleRemoveFile}
                />
                
                {selectedFiles.length > 0 && (
                  <div className="flex justify-end">
                    <Button onClick={handleExtractTitles} disabled={isExtracting} size="lg">
                      {isExtracting ? "Extraindo..." : `Extrair Títulos de ${selectedFiles.length} Arquivo(s)`}
                    </Button>
                  </div>
                )}
              </>
            )}

            {currentStep === 'extract' && isExtracting && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Detectando colunas e extraindo títulos...</p>
              </div>
            )}

            {currentStep === 'enrich' && !processing.status.includes('enriching') && extractionResults && (
              <>
                <TitleExtractionResults
                  extractedTitles={extractionResults.extractedTitles}
                  stats={extractionResults.stats}
                  files={extractionResults.files}
                  onSelectionChange={processing.setSelectedTitles}
                />
                <div className="flex justify-end">
                  <Button onClick={() => handleEnrichData()} size="lg" disabled={processing.selectedTitles.length === 0}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Buscar Metadados com IA ({processing.selectedTitles.length} músicas)
                  </Button>
                </div>
              </>
            )}

            {processing.status === 'enriching' && (
              <EnrichmentProgress
                successCount={stats.enriched}
                failureCount={stats.failed}
              />
            )}

            {(currentStep === 'validate' || currentStep === 'export') && enrichedData.length > 0 && (
              <ValidationTable
                data={enrichedData}
                onUpdate={handleUpdateItem}
              />
            )}
          </div>
        </div>

        <div className="flex justify-end mt-6 gap-4">
          {enrichedData.length > 0 && (
            <>
              <Button
                size="lg"
                onClick={() => {
                  setCurrentStep('export');
                  setExportDialogOpen(true);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleReset}
              >
                Recomeçar
              </Button>
            </>
          )}
        </div>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExportCSV}
      />

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar todos os dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá apagar todos os dados extraídos e enriquecidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReset}>Resetar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar processamento?</AlertDialogTitle>
            <AlertDialogDescription>
              O processamento em andamento será interrompido. Os dados já processados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar Processando</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancel}>Cancelar Processo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const Index = () => (
  <ProcessingProvider>
    <IndexContent />
  </ProcessingProvider>
);

export default Index;
