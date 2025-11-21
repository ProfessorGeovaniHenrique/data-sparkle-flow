import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useProcessing } from '@/contexts/ProcessingContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Clock, Zap, TrendingUp, Sparkles, Search, BarChart3 } from 'lucide-react';

export const PerformanceDashboard = () => {
  const { results } = useProcessing();

  const performanceStats = useMemo(() => {
    const withTiming = results.filter(r => r.processing_duration_ms && r.processing_duration_ms > 0);
    
    if (withTiming.length === 0) {
      return {
        avgTimeOverall: 0,
        avgTimeIA: 0,
        avgTimeWeb: 0,
        successRateOverall: 0,
        successRateIA: 0,
        successRateWeb: 0,
        totalProcessed: 0,
        totalIA: 0,
        totalWeb: 0,
        chartData: [],
      };
    }

    const iaResults = withTiming.filter(r => !r.enriched_by_web);
    const webResults = withTiming.filter(r => r.enriched_by_web);

    const avgTimeOverall = withTiming.reduce((sum, r) => sum + (r.processing_duration_ms || 0), 0) / withTiming.length / 1000;
    const avgTimeIA = iaResults.length > 0 
      ? iaResults.reduce((sum, r) => sum + (r.processing_duration_ms || 0), 0) / iaResults.length / 1000 
      : 0;
    const avgTimeWeb = webResults.length > 0 
      ? webResults.reduce((sum, r) => sum + (r.processing_duration_ms || 0), 0) / webResults.length / 1000 
      : 0;

    const successCount = withTiming.filter(r => r.status_pesquisa.toLowerCase().includes('sucesso')).length;
    const successCountIA = iaResults.filter(r => r.status_pesquisa.toLowerCase().includes('sucesso')).length;
    const successCountWeb = webResults.filter(r => r.status_pesquisa.toLowerCase().includes('sucesso')).length;

    const successRateOverall = (successCount / withTiming.length) * 100;
    const successRateIA = iaResults.length > 0 ? (successCountIA / iaResults.length) * 100 : 0;
    const successRateWeb = webResults.length > 0 ? (successCountWeb / webResults.length) * 100 : 0;

    const chartData = [
      {
        fonte: 'IA',
        tempo_medio: avgTimeIA,
        taxa_sucesso: successRateIA,
        total: iaResults.length,
      },
      {
        fonte: 'Web',
        tempo_medio: avgTimeWeb,
        taxa_sucesso: successRateWeb,
        total: webResults.length,
      },
    ];

    return {
      avgTimeOverall,
      avgTimeIA,
      avgTimeWeb,
      successRateOverall,
      successRateIA,
      successRateWeb,
      totalProcessed: withTiming.length,
      totalIA: iaResults.length,
      totalWeb: webResults.length,
      chartData,
    };
  }, [results]);

  if (performanceStats.totalProcessed === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">
            Nenhum dado de performance disponível ainda.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Processe algumas músicas para visualizar as métricas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Dashboard de Performance
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Análise detalhada de velocidade e eficiência do processamento
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio Geral</CardTitle>
            <div className="p-2 rounded-full bg-primary/10">
              <Clock className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceStats.avgTimeOverall.toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground mt-1">Por música</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio (IA)</CardTitle>
            <div className="p-2 rounded-full bg-enriched/10">
              <Sparkles className="w-4 h-4 text-enriched" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-enriched">{performanceStats.avgTimeIA.toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground mt-1">{performanceStats.totalIA} músicas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio (Web)</CardTitle>
            <div className="p-2 rounded-full bg-warning/10">
              <Search className="w-4 h-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{performanceStats.avgTimeWeb.toFixed(2)}s</div>
            <p className="text-xs text-muted-foreground mt-1">{performanceStats.totalWeb} músicas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <div className="p-2 rounded-full bg-success/10">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{performanceStats.successRateOverall.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">{performanceStats.totalProcessed} processadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Comparação de Performance</CardTitle>
            <CardDescription>Tempo médio de processamento por fonte</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceStats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="fonte" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" label={{ value: 'Segundos', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}s`, 'Tempo Médio']}
                />
                <Legend />
                <Bar dataKey="tempo_medio" fill="hsl(var(--primary))" name="Tempo Médio (s)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Taxa de Sucesso por Fonte</CardTitle>
            <CardDescription>Comparação de efetividade</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceStats.chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="fonte" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" label={{ value: '%', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Taxa de Sucesso']}
                />
                <Legend />
                <Bar dataKey="taxa_sucesso" fill="hsl(var(--success))" name="Taxa de Sucesso (%)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {performanceStats.avgTimeIA < performanceStats.avgTimeWeb && performanceStats.totalWeb > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-enriched/10 border border-enriched/20">
              <Sparkles className="w-5 h-5 text-enriched mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-enriched">IA é mais rápida</p>
                <p className="text-sm text-muted-foreground mt-1">
                  O enriquecimento via IA é{' '}
                  <strong>{((performanceStats.avgTimeWeb / performanceStats.avgTimeIA - 1) * 100).toFixed(0)}% mais rápido</strong>
                  {' '}que a busca web.
                </p>
              </div>
            </div>
          )}
          
          {performanceStats.successRateIA > performanceStats.successRateWeb && performanceStats.totalWeb > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
              <TrendingUp className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-success">IA tem maior taxa de sucesso</p>
                <p className="text-sm text-muted-foreground mt-1">
                  A IA consegue identificar metadados com{' '}
                  <strong>{(performanceStats.successRateIA - performanceStats.successRateWeb).toFixed(1)}%</strong>
                  {' '}mais efetividade que a busca web.
                </p>
              </div>
            </div>
          )}

          {performanceStats.avgTimeOverall < 2 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Zap className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-primary">Performance Excelente</p>
                <p className="text-sm text-muted-foreground mt-1">
                  O sistema está processando músicas em menos de 2 segundos em média. Excelente velocidade!
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
