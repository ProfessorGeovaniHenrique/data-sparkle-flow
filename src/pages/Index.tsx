import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { StatsCard } from "@/components/StatsCard";
import { ProcessingPipeline } from "@/components/ProcessingPipeline";
import { TitleExtractionResults } from "@/components/TitleExtractionResults";
import { EnrichmentProgress } from "@/components/EnrichmentProgress";
import { ValidationTable, EnrichedMusicItem } from "@/components/ValidationTable";
import { ExportDialog, ExportOptions } from "@/components/ExportDialog";
import { Database, Sparkles, CheckCircle, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'extract' | 'enrich' | 'validate' | 'export'>('upload');
  
  const [extractionResults, setExtractionResults] = useState<{
    rawCount: number;
    cleanCount: number;
    titles: string[];
    detectionResults: any[];
  } | null>(null);
  
  const [enrichedData, setEnrichedData] = useState<EnrichedMusicItem[]>([]);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ total: 0, processed: 0, currentSong: '' });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const stats = {
    titlesFound: extractionResults?.rawCount || 0,
    titlesClean: extractionResults?.cleanCount || 0,
    enriched: enrichedData.filter(d => d.status_pesquisa === 'Sucesso').length,
    failed: enrichedData.filter(d => d.status_pesquisa === 'Falha').length,
  };

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
    
    try {
      const formData = new FormData();
      selectedFiles.forEach(file => formData.append('files', file));

      const { data: result, error } = await supabase.functions.invoke('extract-music-titles', {
        body: formData
      });

      if (error) throw error;
      if (!result) throw new Error('No result from extraction');

      setExtractionResults(result);
      setSelectedFiles([]);
      
      toast.success(`${result.cleanCount} títulos únicos extraídos!`);
      setCurrentStep('enrich');
    } catch (error: any) {
      toast.error("Erro ao extrair títulos: " + error.message);
      console.error(error);
      setCurrentStep('upload');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleEnrichData = async () => {
    if (!extractionResults || extractionResults.titles.length === 0) {
      toast.error("Nenhum título para enriquecer");
      return;
    }

    setIsEnriching(true);
    setCurrentStep('enrich');
    setEnrichmentProgress({ total: extractionResults.titles.length, processed: 0, currentSong: '' });

    try {
      const batchSize = 20;
      let allEnriched: EnrichedMusicItem[] = [];

      for (let i = 0; i < extractionResults.titles.length; i += batchSize) {
        const batch = extractionResults.titles.slice(i, i + batchSize);
        
        setEnrichmentProgress({
          total: extractionResults.titles.length,
          processed: i,
          currentSong: batch[0] || ''
        });

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
          throw error;
        }

        allEnriched = [...allEnriched, ...result.enrichedData];
      }

      setEnrichedData(allEnriched);
      setEnrichmentProgress({ 
        total: extractionResults.titles.length, 
        processed: allEnriched.length, 
        currentSong: '' 
      });
      
      toast.success(`${allEnriched.length} músicas enriquecidas!`);
      setCurrentStep('validate');
    } catch (error: any) {
      toast.error("Erro ao enriquecer dados: " + error.message);
      console.error(error);
    } finally {
      setIsEnriching(false);
    }
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
    setExtractionResults(null);
    setEnrichedData([]);
    setCurrentStep('upload');
    setSelectedFiles([]);
    toast.success("Dados resetados!");
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

            {currentStep === 'enrich' && !isEnriching && extractionResults && (
              <>
                <TitleExtractionResults
                  rawCount={extractionResults.rawCount}
                  cleanCount={extractionResults.cleanCount}
                  detectionResults={extractionResults.detectionResults}
                />
                <div className="flex justify-end">
                  <Button onClick={handleEnrichData} size="lg">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Buscar Metadados com IA ({extractionResults.cleanCount} músicas)
                  </Button>
                </div>
              </>
            )}

            {currentStep === 'enrich' && isEnriching && (
              <EnrichmentProgress
                total={enrichmentProgress.total}
                processed={enrichmentProgress.processed}
                currentSong={enrichmentProgress.currentSong}
              />
            )}

            {(currentStep === 'validate' || currentStep === 'export') && enrichedData.length > 0 && (
              <ValidationTable
                data={enrichedData}
              />
            )}
          </div>

          <div className="space-y-4">
            {enrichedData.length > 0 && (
              <>
                <Button
                  className="w-full"
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
                  className="w-full"
                  variant="outline"
                  onClick={handleReset}
                >
                  Recomeçar
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExportCSV}
      />
    </div>
  );
};

export default Index;
