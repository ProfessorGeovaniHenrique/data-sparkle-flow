import React, { useState, useCallback, useRef } from 'react';
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { FileUpload } from '@/components/FileUpload';
import { ProcessingControl } from '@/components/ProcessingControl';
import { ProcessingDashboard } from '@/components/ProcessingDashboard';
import { PerformanceDashboard } from '@/components/PerformanceDashboard';
import { WorkflowTabs } from '@/components/WorkflowTabs';
import { ErrorLog } from '@/components/ErrorLog';
import { Download, Music, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ParseResult, ParsedMusic } from '@/lib/excelParser';
import { BatchProcessor, EnrichedMusicData } from '@/lib/batchProcessor';
import { useProcessing } from '@/contexts/ProcessingContext';

const IndexContent = () => {
  const processingContext = useProcessing();
  const processorRef = useRef<BatchProcessor | null>(null);

  const isProcessing = processingContext.status === 'enriching' || processingContext.status === 'paused';
  const enrichedData = processingContext.results;
  
  const queuedItems = processingContext.getQueuedItems();
  const pendingItems = processingContext.getPendingItems();
  const approvedItems = processingContext.getApprovedItems();

  const handleFilesSelected = useCallback((rawFiles: File[], parsedResults: ParseResult[]) => {
    const allMusics = parsedResults.flatMap(result => result.extractedData);
    
    // Log de debug: Músicas após flatMap
    console.log('[Index] Músicas após flatMap:', allMusics.length);

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
    
    // Log de debug: Músicas únicas após filtro
    console.log('[Index] Músicas únicas:', uniqueMusics.length);

    processingContext.setSelectedTitles(uniqueMusics.map(m => m.titulo));
    toast.success(`${uniqueMusics.length} músicas únicas prontas para processamento.`);
    startBatchProcessing(uniqueMusics);
  }, [processingContext]);

  const startBatchProcessing = async (musicsToProcess: ParsedMusic[]) => {
    // Log de debug: Músicas recebidas para processamento
    console.log('[Index] Iniciando startBatchProcessing com:', musicsToProcess.length, 'músicas');
    console.log('[Index] Primeiras 3 músicas:', musicsToProcess.slice(0, 3));
    
    processingContext.reset();
    
    // Aguardar propagação do estado após reset
    await new Promise(resolve => setTimeout(resolve, 50));

    const processBatchFn = async (batch: ParsedMusic[]): Promise<EnrichedMusicData[]> => {
      console.log('[Index] processBatchFn chamado com', batch.length, 'items');
      const payload = batch.map(m => ({ id: m.id, titulo: m.titulo, artista_contexto: m.artista }));
      console.log('[Index] Payload criado:', payload.slice(0, 2)); // Primeiros 2 para não poluir o log

      console.log('[Index] Invocando supabase.functions.invoke("enrich-music-data")...');
      const { data, error } = await supabase.functions.invoke('enrich-music-data', {
        body: { musics: payload }
      });

      console.log('[Index] Resposta recebida - data:', !!data, 'error:', !!error);

      if (error) {
        console.error('[Index] Edge Function error:', error);
        throw new Error(`Edge Function error: ${error.message}`);
      }

      if (!data || !data.results || !Array.isArray(data.results)) {
        console.error('[Index] Resposta inválida:', data);
        throw new Error("Invalid response format from enrichment function.");
      }

      console.log('[Index] Retornando', data.results.length, 'resultados');
      return data.results as EnrichedMusicData[];
    };

    // Log de debug: Antes de criar BatchProcessor
    console.log('[Index] Criando BatchProcessor com:', musicsToProcess.length, 'items');

    processorRef.current = new BatchProcessor(
      musicsToProcess,
      50,
      processBatchFn,
      processingContext
    );

        toast.info("Iniciando processamento em lotes. Seu progresso será salvo automaticamente.");
        await processorRef.current.start();
        console.log('[Index] BatchProcessor.start() concluído');
  };

  const handleRetryFailed = (failedItems: string[]) => {
    toast.info(`Reprocessamento de ${failedItems.length} itens falhados não implementado ainda.`);
  };

  const handleNewProcessing = () => {
    processingContext.clearSavedState();
  };

  const handleDownloadCSV = () => {
    const approvedData = processingContext.getApprovedItems();
    
    if (approvedData.length === 0) {
      toast.warning("Não há músicas aprovadas para exportar.");
      return;
    }

    const csvRows = [
      ['Título Original', 'Artista Encontrado', 'Compositor', 'Ano', 'Status', 'Observações'].join(';')
    ];

    approvedData.forEach(item => {
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
    link.setAttribute('download', `musicas_aprovadas_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${approvedData.length} músicas aprovadas exportadas com sucesso!`);
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
          <div className="flex gap-2">
            {enrichedData.length > 0 && (
              <>
                <Button onClick={handleDownloadCSV} className="gap-2 shadow-lg hover:shadow-xl transition-all">
                  <Download className="w-5 h-5" /> Exportar CSV ({approvedItems.length})
                </Button>
                {!isProcessing && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        <RotateCcw className="w-4 h-4" />
                        Novo Processamento
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deseja começar do zero?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação irá apagar todo o progresso atual ({enrichedData.length} músicas processadas).
                          Se você não exportou os dados, eles serão perdidos.
                          <br/><br/>
                          <strong>Esta ação não pode ser desfeita.</strong>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleNewProcessing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Sim, apagar tudo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </>
            )}
          </div>
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

        {(enrichedData.length > 0 || isProcessing) && (
          <Tabs defaultValue="realtime" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="realtime">Dashboard em Tempo Real</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>
            <TabsContent value="realtime">
              <ProcessingDashboard />
            </TabsContent>
            <TabsContent value="performance">
              <PerformanceDashboard />
            </TabsContent>
          </Tabs>
        )}

        {enrichedData.length > 0 && (
          <WorkflowTabs 
            queuedItems={queuedItems}
            pendingItems={pendingItems}
            approvedItems={approvedItems}
            isProcessing={isProcessing}
          />
        )}
      </div>
    </div>
  );
};

export default IndexContent;
