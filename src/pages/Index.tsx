import { useState } from "react";
import { FileUpload } from "@/components/FileUpload";
import { StatsCard } from "@/components/StatsCard";
import { DataTable } from "@/components/DataTable";
import { ActionButtons } from "@/components/ActionButtons";
import { Database, FileText, CheckCircle, XCircle, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface DataRow {
  id: string;
  [key: string]: any;
  status: "pending" | "enriched" | "validated" | "rejected";
}

const Index = () => {
  const [data, setData] = useState<DataRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const stats = {
    total: data.length,
    pending: data.filter(d => d.status === "pending").length,
    enriched: data.filter(d => d.status === "enriched").length,
    validated: data.filter(d => d.status === "validated").length,
    rejected: data.filter(d => d.status === "rejected").length,
  };

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const processedData: DataRow[] = jsonData.map((row: any, index: number) => ({
        id: `row-${index}`,
        ...row,
        status: "pending" as const,
      }));

      setData(processedData);
      toast.success(`${processedData.length} registros carregados com sucesso!`);
    } catch (error) {
      toast.error("Erro ao processar arquivo");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnrich = async (id: string) => {
    setData(prev =>
      prev.map(row =>
        row.id === id ? { ...row, status: "enriched" as const } : row
      )
    );
    toast.success("Registro enriquecido com sucesso!");
  };

  const handleValidate = (id: string) => {
    setData(prev =>
      prev.map(row =>
        row.id === id ? { ...row, status: "validated" as const } : row
      )
    );
    toast.success("Registro validado!");
  };

  const handleBatchProcess = async () => {
    setIsProcessing(true);
    toast.info("Iniciando processamento em lote...");
    
    // Simular processamento
    setTimeout(() => {
      setData(prev =>
        prev.map(row =>
          row.status === "pending" ? { ...row, status: "enriched" as const } : row
        )
      );
      setIsProcessing(false);
      toast.success("Processamento em lote concluído!");
    }, 2000);
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
    XLSX.writeFile(workbook, "dados_processados.xlsx");
    toast.success("Arquivo exportado com sucesso!");
  };

  const handleClearPending = () => {
    setData(prev => prev.filter(row => row.status !== "pending"));
    toast.success("Registros pendentes removidos!");
  };

  const handleReset = () => {
    setData([]);
    toast.success("Dados resetados!");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Database className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Sistema de Processamento de Dados</h1>
            <p className="text-muted-foreground">
              Enriquecimento e validação de dados estruturados via IA
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
          <StatsCard title="Total" value={stats.total} icon={Database} />
          <StatsCard title="Pendentes" value={stats.pending} icon={AlertCircle} variant="warning" />
          <StatsCard title="Enriquecidos" value={stats.enriched} icon={Sparkles} variant="enriched" />
          <StatsCard title="Validados" value={stats.validated} icon={CheckCircle} variant="success" />
          <StatsCard title="Rejeitados" value={stats.rejected} icon={XCircle} variant="destructive" />
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-6">
            {data.length === 0 ? (
              <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
            ) : (
              <DataTable
                data={data}
                onEnrich={handleEnrich}
                onValidate={handleValidate}
              />
            )}
          </div>

          <div className="space-y-6">
            <ActionButtons
              onBatchProcess={handleBatchProcess}
              onExport={handleExport}
              onClearPending={handleClearPending}
              onReset={handleReset}
              isProcessing={isProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
