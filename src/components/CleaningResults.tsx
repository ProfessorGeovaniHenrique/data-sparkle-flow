import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Link, Sparkles, FileText } from "lucide-react";
import { CleaningStats } from "@/types/music";

interface CleaningResultsProps {
  stats: CleaningStats;
}

export const CleaningResults = ({ stats }: CleaningResultsProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Resultados da Limpeza</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Original</p>
              <p className="text-2xl font-bold">{stats.total_rows}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Final</p>
              <p className="text-2xl font-bold text-success">{stats.final_count}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duplicatas Removidas</p>
              <p className="text-xl font-bold text-warning">{stats.duplicates_removed}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-enriched/10 flex items-center justify-center">
              <Link className="w-5 h-5 text-enriched" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Links Removidos</p>
              <p className="text-xl font-bold text-enriched">{stats.links_removed}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 col-span-2">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ruídos Limpos</p>
              <p className="text-xl font-bold">{stats.noise_cleaned}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
