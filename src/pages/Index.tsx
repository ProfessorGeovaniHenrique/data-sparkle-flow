import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { StatsCard } from "@/components/StatsCard";
import { ProcessingPipeline } from "@/components/ProcessingPipeline";
import { CleaningResults } from "@/components/CleaningResults";
import { EnrichmentProgress } from "@/components/EnrichmentProgress";
import { ValidationTable } from "@/components/ValidationTable";
import { ExportDialog, ExportOptions } from "@/components/ExportDialog";
import { Database, Sparkles, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MusicData, CleaningStats } from "@/types/music";

const Index = () => {
  const [musicData, setMusicData] = useState<MusicData[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [currentStep, setCurrentStep] = useState<'upload' | 'process' | 'enrich' | 'validate' | 'export'>('upload');
  const [cleaningStats, setCleaningStats] = useState<CleaningStats | null>(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState({ total: 0, processed: 0, currentSong: '' });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const stats = {
    total: musicData.length,
    pending: musicData.filter(d => d.status === "uploaded" || d.status === "processed" || d.status === "ready_for_enrichment").length,
    enriched: musicData.filter(d => d.status === "enriched" || d.status === "enriching").length,
    validated: musicData.filter(d => d.status === "validated").length,
    rejected: musicData.filter(d => d.status === "rejected").length,
  };

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
    toast.success(`${files.length} arquivo(s) adicionado(s)`);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    toast.info("Arquivo removido");
  };

  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Nenhum arquivo selecionado");
      return;
    }

    setIsProcessing(true);
    setCurrentStep('process');
    
    try {
      // Read all files and combine data
      let allRawData: any[] = [];
      
      for (const file of selectedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        allRawData = [...allRawData, ...jsonData.map((row: any) => ({ ...row, source_file: file.name }))];
      }

      // Call edge function to process and clean data
      const { data: result, error } = await supabase.functions.invoke('process-music-data', {
        body: { data: allRawData }
      });

      if (error) throw error;
      if (!result) throw new Error('No result from processing');

      const processedMusicData: MusicData[] = result.processed_data;
      setMusicData(processedMusicData);
      setCleaningStats(result.stats);
      setSelectedFiles([]);
      
      toast.success(`${result.stats.final_count} músicas processadas e limpas!`);
      setCurrentStep('enrich');
    } catch (error: any) {
      toast.error("Erro ao processar arquivos: " + error.message);
      console.error(error);
      setCurrentStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnrichData = async () => {
    const processedSongs = musicData.filter(d => d.status === 'processed');
    
    if (processedSongs.length === 0) {
      toast.error("Nenhuma música processada para enriquecer");
      return;
    }

    setIsEnriching(true);
    setCurrentStep('enrich');
    setEnrichmentProgress({ total: processedSongs.length, processed: 0, currentSong: '' });

    try {
      // Process in batches of 10
      const batchSize = 10;
      let allEnriched: MusicData[] = [];

      for (let i = 0; i < processedSongs.length; i += batchSize) {
        const batch = processedSongs.slice(i, i + batchSize);
        
        setEnrichmentProgress({
          total: processedSongs.length,
          processed: i,
          currentSong: batch[0]?.processed_data?.nome_musica || ''
        });

        const { data: result, error } = await supabase.functions.invoke('enrich-music-data', {
          body: { songs: batch }
        });

        if (error) {
          if (error.message.includes('429')) {
            toast.error("Limite de requisições atingido. Aguarde um momento...");
            await new Promise(resolve => setTimeout(resolve, 5000));
            i -= batchSize; // Retry this batch
            continue;
          }
          if (error.message.includes('402')) {
            toast.error("Créditos insuficientes. Adicione créditos à sua conta Lovable AI.");
            break;
          }
          throw error;
        }

        allEnriched = [...allEnriched, ...result.enriched_songs];
      }

      // Update music data with enriched results
      setMusicData(prev => 
        prev.map(song => {
          const enriched = allEnriched.find(e => e.id === song.id);
          return enriched || song;
        })
      );

      setEnrichmentProgress({ total: processedSongs.length, processed: processedSongs.length, currentSong: '' });
      toast.success(`${allEnriched.length} músicas enriquecidas com sucesso!`);
      setCurrentStep('validate');
    } catch (error: any) {
      toast.error("Erro ao enriquecer dados: " + error.message);
      console.error(error);
    } finally {
      setIsEnriching(false);
    }
  };

  const handleValidate = (id: string) => {
    setMusicData(prev =>
      prev.map(song =>
        song.id === id ? { ...song, status: "validated" as const, validated_at: new Date().toISOString() } : song
      )
    );
    toast.success("Música validada!");
  };

  const handleReject = (id: string) => {
    setMusicData(prev =>
      prev.map(song =>
        song.id === id ? { ...song, status: "rejected" as const } : song
      )
    );
    toast.success("Música rejeitada!");
  };

  const handleEdit = (id: string, updates: Partial<MusicData>) => {
    setMusicData(prev =>
      prev.map(song =>
        song.id === id ? { ...song, ...updates } : song
      )
    );
    toast.success("Dados atualizados!");
  };

  const handleDownloadProcessed = () => {
    const dataToExport = musicData
      .filter(d => d.status === 'processed')
      .map(d => ({
        'Nome da Música': d.processed_data?.nome_musica,
        'Autor': d.processed_data?.autor,
        'Letra': d.processed_data?.letra,
        'Arquivo Original': d.source_file,
      }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados Processados");
    XLSX.writeFile(workbook, "musicas_processadas.xlsx");
    toast.success("Dados processados exportados!");
  };

  const handleExport = (options: ExportOptions) => {
    let dataToExport = musicData;

    // Filter based on options
    if (options.filter === 'validated') {
      dataToExport = musicData.filter(d => d.status === 'validated');
    } else if (options.filter === 'validated_and_rejected') {
      dataToExport = musicData.filter(d => d.status === 'validated' || d.status === 'rejected');
    }

    const workbook = XLSX.utils.book_new();

    if (options.multipleSheets) {
      // Multiple sheets
      const validated = dataToExport.filter(d => d.status === 'validated').map(formatForExport(options.includeOriginal));
      const rejected = dataToExport.filter(d => d.status === 'rejected').map(formatForExport(options.includeOriginal));
      const all = dataToExport.map(formatForExport(options.includeOriginal));

      if (validated.length > 0) {
        const ws1 = XLSX.utils.json_to_sheet(validated);
        XLSX.utils.book_append_sheet(workbook, ws1, "Aprovados");
      }
      if (rejected.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(rejected);
        XLSX.utils.book_append_sheet(workbook, ws2, "Rejeitados");
      }
      if (all.length > 0) {
        const ws3 = XLSX.utils.json_to_sheet(all);
        XLSX.utils.book_append_sheet(workbook, ws3, "Todos");
      }
    } else {
      // Single sheet
      const formattedData = dataToExport.map(formatForExport(options.includeOriginal));
      const worksheet = XLSX.utils.json_to_sheet(formattedData);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    }

    XLSX.writeFile(workbook, "musicas_final.xlsx");
    toast.success("Exportação concluída!");
  };

  const formatForExport = (includeOriginal: boolean) => (song: MusicData) => {
    const base: any = {
      'Nome da Música': song.processed_data?.nome_musica,
      'Autor': song.processed_data?.autor,
      'Letra': song.processed_data?.letra,
      'Status': song.status,
    };

    if (song.enriched_data) {
      base['Compositor'] = song.enriched_data.compositor || '';
      base['Ano'] = song.enriched_data.ano_lancamento || '';
      base['Álbum'] = song.enriched_data.album || '';
      base['Gênero'] = song.enriched_data.genero || '';
      base['Gravadora'] = song.enriched_data.gravadora || '';
      base['País'] = song.enriched_data.pais_origem || '';
    }

    if (includeOriginal) {
      base['Dados Originais'] = JSON.stringify(song.original_data);
    }

    return base;
  };

  const handleReset = () => {
    setMusicData([]);
    setCleaningStats(null);
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
            <h1 className="text-3xl font-bold">Sistema de Processamento de Dados Musicais</h1>
            <p className="text-muted-foreground">
              Limpeza, enriquecimento via IA e validação de dados musicais
            </p>
          </div>
        </div>

        <ProcessingPipeline currentStep={currentStep} />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <StatsCard title="Total" value={stats.total} icon={Database} />
          <StatsCard title="Pendentes" value={stats.pending} icon={AlertCircle} variant="warning" />
          <StatsCard title="Enriquecidos" value={stats.enriched} icon={Sparkles} variant="enriched" />
          <StatsCard title="Validados" value={stats.validated} icon={CheckCircle} variant="success" />
          <StatsCard title="Rejeitados" value={stats.rejected} icon={XCircle} variant="destructive" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {currentStep === 'upload' && (
              <>
                <FileUpload
                  onFilesSelect={handleFilesSelect}
                  isProcessing={isProcessing}
                  selectedFiles={selectedFiles}
                  onRemoveFile={handleRemoveFile}
                />
                
                {selectedFiles.length > 0 && (
                  <div className="flex justify-end">
                    <Button onClick={handleProcessFiles} disabled={isProcessing} size="lg">
                      {isProcessing ? "Processando..." : `Processar ${selectedFiles.length} Arquivo(s)`}
                    </Button>
                  </div>
                )}
              </>
            )}

            {currentStep === 'process' && isProcessing && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Processando e limpando dados...</p>
              </div>
            )}

            {currentStep === 'enrich' && !isEnriching && cleaningStats && (
              <>
                <CleaningResults stats={cleaningStats} />
                <div className="flex gap-3">
                  <Button onClick={handleDownloadProcessed} variant="outline" className="flex-1">
                    Baixar Dados Processados
                  </Button>
                  <Button onClick={handleEnrichData} className="flex-1">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Enviar para Enriquecimento IA
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

            {(currentStep === 'validate' || currentStep === 'export') && (
              <ValidationTable
                data={musicData}
                onValidate={handleValidate}
                onReject={handleReject}
                onEdit={handleEdit}
              />
            )}
          </div>

          <div className="space-y-4">
            {musicData.length > 0 && (
              <>
                <Button
                  className="w-full"
                  onClick={() => {
                    setCurrentStep('export');
                    setExportDialogOpen(true);
                  }}
                  disabled={musicData.filter(d => d.status === 'validated').length === 0}
                >
                  Exportar Dados Finais
                </Button>
                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={handleReset}
                >
                  Reset Completo
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExport}
      />
    </div>
  );
};

export default Index;
