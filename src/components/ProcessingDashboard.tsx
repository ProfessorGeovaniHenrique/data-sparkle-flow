import { useMemo, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/StatsCard";
import { useProcessing } from "@/contexts/ProcessingContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Music,
  Users,
  Pen,
  TrendingUp,
  Sparkles,
  Search,
  Zap,
  Clock,
  BarChart3,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export const ProcessingDashboard = () => {
  const { results, progress, status } = useProcessing();
  const logRef = useRef<HTMLDivElement>(null);

  // Scroll automático para o final do log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [results.length]);

  // Cálculo de estatísticas
  const stats = useMemo(() => {
    const totalMusicas = results.length;
    const artistasUnicos = new Set(
      results.map((r) => r.artista_encontrado).filter(Boolean)
    ).size;
    const compositoresUnicos = new Set(
      results.map((r) => r.compositor_encontrado).filter(Boolean)
    ).size;

    const sucessos = results.filter((r) =>
      r.status_pesquisa.toLowerCase().includes("sucesso")
    ).length;
    const taxaSucesso = totalMusicas > 0 ? ((sucessos / totalMusicas) * 100).toFixed(1) : "0";

    const enriquecidosIA = results.filter((r) => !r.enriched_by_web).length;
    const enriquecidosWeb = results.filter((r) => r.enriched_by_web).length;

    const aprovadas = results.filter((r) => r.approval_status === "approved").length;
    const pendentes = results.filter((r) => r.approval_status === "pending").length;

    // Distribuição por ano
    const distribuicaoPorAno = results.reduce((acc, item) => {
      const ano = item.ano_lancamento;
      if (ano && ano !== "0000" && ano !== "Desconhecido" && ano.trim() !== "") {
        acc[ano] = (acc[ano] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const dadosGraficoAno = Object.entries(distribuicaoPorAno)
      .map(([ano, quantidade]) => ({ ano, quantidade }))
      .sort((a, b) => a.ano.localeCompare(b.ano))
      .slice(-15); // Últimos 15 anos para melhor visualização

    return {
      totalMusicas,
      artistasUnicos,
      compositoresUnicos,
      taxaSucesso,
      enriquecidosIA,
      enriquecidosWeb,
      aprovadas,
      pendentes,
      dadosGraficoAno,
    };
  }, [results]);

  // Log de atividades
  const atividades = useMemo(() => {
    return results
      .slice(-20)
      .reverse()
      .map((item, idx) => {
        const isSuccess = item.status_pesquisa.toLowerCase().includes("sucesso");
        return {
          id: `${item.titulo_original}-${idx}`,
          timestamp: new Date(),
          message: `${item.titulo_original} - ${item.artista_encontrado || "Artista desconhecido"}`,
          fonte: item.enriched_by_web ? "Web" : "IA",
          type: isSuccess ? ("success" as const) : ("warning" as const),
        };
      });
  }, [results]);

  // Dados para gráfico de pizza
  const dadosEnriquecimento = [
    { name: "IA", value: stats.enriquecidosIA },
    { name: "Web", value: stats.enriquecidosWeb },
  ].filter((item) => item.value > 0);

  const COLORS = {
    IA: "hsl(var(--enriched))",
    Web: "hsl(var(--warning))",
  };

  if (results.length === 0) {
    const hasProgress = progress.total > 0 && progress.current === 0;
    
    if (hasProgress) {
      return (
        <div className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 animate-pulse" />
                Preparando Processamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total de músicas na fila:</span>
                  <span className="font-semibold">{progress.total}</span>
                </div>
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Enviando lote inicial para processamento...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <Card className="mt-6">
        <CardContent className="text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground text-lg font-semibold">
            {status === 'enriching' ? 'Iniciando processamento...' : 'Aguardando início do processamento...'}
          </p>
          {status === 'enriching' && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                🔄 Conectando à API de enriquecimento...
              </p>
              <p className="text-xs text-muted-foreground/70">
                Os primeiros resultados aparecerão em instantes
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Header do Dashboard */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Dashboard em Tempo Real
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe o progresso e as estatísticas do processamento
          </p>
        </div>
        {status === "enriching" && (
          <Badge variant="secondary" className="animate-pulse">
            🔄 Processando...
          </Badge>
        )}
      </div>

      {/* Grid de Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total de Músicas" value={stats.totalMusicas} icon={Music} />
        <StatsCard
          title="Artistas Únicos"
          value={stats.artistasUnicos}
          icon={Users}
          variant="enriched"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <div className="p-2 rounded-full bg-success/10">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.taxaSucesso}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Velocidade</CardTitle>
            <div className="p-2 rounded-full bg-warning/10">
              <Zap className="w-4 h-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {progress.speed?.toFixed(1) || 0}/s
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Segunda linha de cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Compositores"
          value={stats.compositoresUnicos}
          icon={Pen}
        />
        <StatsCard
          title="Enriquecidas (IA)"
          value={stats.enriquecidosIA}
          icon={Sparkles}
          variant="enriched"
        />
        <StatsCard
          title="Enriquecidas (Web)"
          value={stats.enriquecidosWeb}
          icon={Search}
          variant="warning"
        />
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Restante</CardTitle>
            <div className="p-2 rounded-full bg-muted">
              <Clock className="w-4 h-4 text-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {progress.estimatedTimeRemaining
                ? `${Math.ceil(progress.estimatedTimeRemaining / 60)}min`
                : "--"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Distribuição por Ano */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Distribuição por Ano
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.dadosGraficoAno.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.dadosGraficoAno}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="ano"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="quantidade"
                    fill="hsl(var(--primary))"
                    name="Músicas"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados de ano disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Fonte de Enriquecimento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Fonte de Enriquecimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dadosEnriquecimento.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dadosEnriquecimento}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosEnriquecimento.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={COLORS[entry.name as keyof typeof COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados de enriquecimento disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log de Atividades em Tempo Real */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Atividades Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]" ref={logRef}>
            {atividades.length > 0 ? (
              <div className="space-y-2">
                {atividades.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {log.type === "success" ? (
                      <CheckCircle className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{log.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={log.fonte === "IA" ? "default" : "secondary"} className="text-xs">
                          {log.fonte}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhuma atividade recente
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
