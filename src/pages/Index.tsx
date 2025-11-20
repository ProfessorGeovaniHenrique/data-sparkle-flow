import React, { useState, useCallback, useRef } from 'react';
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingControl } from '@/components/ProcessingControl';
import EnrichedDataTable from '@/components/EnrichedDataTable';
import { ErrorLog } from '@/components/ErrorLog';
import { Download, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ParseResult, ParsedMusic } from '@/lib/excelParser';
import { BatchProcessor, EnrichedMusicData } from '@/lib/batchProcessor';
import { ProcessingProvider, useProcessing } from '@/contexts/ProcessingContext';

const IndexContent = () => {
  const [enrichedData, setEnrichedData] = useState<EnrichedMusicData[]>([]);
  const processorRef = useRef<BatchProcessor | null>(null);
  const processingContext = useProcessing();

  const isProcessing = processingContext.status === 'processing' || processingContext.status === 'paused';

  const handleFilesSelected = useCallback((rawFiles: File[], parsedResults: ParseResult[]) => {
    const allMusics = parsedResults.flatMap(result => result.extractedData);

    if (allMusics.length === 0) {
      toast.error("Nenhuma música válida foi encontrada nos arquivos selecionados.");
      return;
    }

    const uniqueMusics = allMusics.filter((music, index, self) =>
      index === self.findIndex((t) => (
        t.titulo.toLowerCase() === music.titulo.toLowerCase() &&
        (t.artista || '').toLowerCase() === (music.artista || '').toLowerCase()
      ))
    );

    processingContext.setSelectedTitles(uniqueMusics.map(m => m.titulo));
    toast.success(`${uniqueMusics.length} músicas únicas prontas para processamento.`);
    startBatchProcessing(uniqueMusics);
  }, [processingContext]);

  const startBatchProcessing = async (musicsToProcess: ParsedMusic[]) => {
    setEnrichedData([]);
    processingContext.reset();

    const processBatchFn = async (batch: ParsedMusic[]): Promise<EnrichedMusicData[]> => {
      const payload = batch.map(m => ({ id: m.id, titulo: m.titulo, artista_contexto: m.artista }));

      const { data, error } = await supabase.functions.invoke('enrich-music-data', {
        body: { musics: payload }
      });

      if (error) {
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (!data || !data.results || !Array.isArray(data.results)) {
        throw new Error("Invalid response format from enrichment function.");
      }

      return data.results as EnrichedMusicData[];
    };

    processorRef.current = new BatchProcessor(
      musicsToProcess,
      50,
      processBatchFn,
      processingContext
    );

    toast.info("Iniciando processamento em lotes de 50 músicas...");
    
    const results = await processorRef.current.start();
    setEnrichedData(results);
  };

  const handleRetryFailed = (failedItems: string[]) => {
    toast.info(`Reprocessamento de ${failedItems.length} itens falhados não implementado ainda.`);
  };

  const handleDownloadCSV = () => {
    if (enrichedData.length === 0) {
      toast.warning("Não há dados processados para exportar.");
      return;
    }

    const csvRows = [
      ['Título Original', 'Artista Encontrado', 'Compositor', 'Ano', 'Status', 'Observações'].join(';')
    ];

    enrichedData.forEach(item => {
      const row = [
        `"${item.titulo_original.replace(/"/g, '""')}"`,
        `"${item.artista_encontrado.replace(/"/g, '""')}"`,
        `"${item.compositor_encontrado.replace(/"/g, '""')}"`,
        item.ano_lancamento,
        item.status_pesquisa,
        `"${(item.observacoes || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(';'));
    });

    const csvString = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `musicas_enriquecidas_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Arquivo CSV gerado e baixado com sucesso!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10">
              <Music className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                Enriquecedor de Metadados Musicais
              </h1>
              <p className="text-muted-foreground mt-1">
                Processe milhares de músicas com IA - Parsing local + Batch processing
              </p>
            </div>
          </div>
          {enrichedData.length > 0 && !isProcessing && (
            <Button onClick={handleDownloadCSV} className="gap-2">
              <Download className="w-5 h-5" /> Exportar CSV ({enrichedData.length})
            </Button>
          )}
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-1">
          {!isProcessing && processingContext.status !== 'completed' ? (
            <FileUpload
              onFilesSelect={handleFilesSelected}
              isProcessing={isProcessing}
            />
          ) : (
            <ProcessingControl />
          )}
        </div>

        {processingContext.errors.length > 0 && (
          <ErrorLog onRetry={handleRetryFailed} />
        )}

        {enrichedData.length > 0 && (
          <EnrichedDataTable data={enrichedData} isLoading={isProcessing} />
        )}
      </div>
    </div>
  );
};

const Index = () => (
  <ProcessingProvider>
    <IndexContent />
  </ProcessingProvider>
);

export default Index;
