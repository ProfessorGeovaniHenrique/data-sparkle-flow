import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SongCardProps {
  title: string;
  composer: string | null;
  releaseYear: string | null;
  lyrics: string | null;
  status: string;
  enrichmentSource: string | null;
  confidenceScore: number;
  isRecentlyEnriched?: boolean;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-gray-500' },
  enriching: { label: 'Enriquecendo', color: 'bg-blue-500 animate-pulse' },
  enriched: { label: 'Enriquecido', color: 'bg-green-500' },
  approved: { label: 'Aprovado', color: 'bg-purple-500' },
  rejected: { label: 'Rejeitado', color: 'bg-red-500' }
};

export function SongCard({
  title,
  composer,
  releaseYear,
  lyrics,
  status,
  enrichmentSource,
  confidenceScore,
  isRecentlyEnriched = false
}: SongCardProps) {
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const statusInfo = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  const isEnriched = status === 'enriched' || status === 'approved';
  
  // Extrair apenas a primeira linha como título (dados têm letra no campo title)
  const displayTitle = title?.split('\n')[0]?.trim() || 'Título não identificado';
  
  console.log('SongCard - Title recebido:', title?.substring(0, 100));
  console.log('SongCard - Display title:', displayTitle);

  return (
    <Card 
      className={cn(
        "transition-all duration-300",
        isRecentlyEnriched && "border-green-500 shadow-lg shadow-green-500/20 animate-scale-in"
      )}
    >
      <CardHeader className="pb-3">
        {/* Header: Título e Badges */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-2xl font-bold flex-1 leading-tight text-foreground">
              {displayTitle}
            </h3>
            <div className="flex gap-2 shrink-0">
              <Badge className={statusInfo.color}>
                {statusInfo.label}
              </Badge>
              {isRecentlyEnriched && (
                <Badge variant="outline" className="border-green-500 text-green-600 animate-fade-in">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Novo
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Grid de Metadados */}
        <div className="grid grid-cols-2 gap-3">
          {/* Compositor */}
          <div 
            className={cn(
              "rounded-lg p-3 border transition-colors",
              isEnriched && composer 
                ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" 
                : "bg-muted/50 border-border"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Compositor
              </span>
              {isEnriched && composer && (
                <Sparkles className="w-3 h-3 text-green-600" />
              )}
            </div>
            <p className={cn(
              "text-sm font-semibold",
              composer ? "text-foreground" : "text-muted-foreground italic"
            )}>
              {composer || 'Não identificado'}
            </p>
          </div>

          {/* Ano */}
          <div 
            className={cn(
              "rounded-lg p-3 border transition-colors",
              isEnriched && releaseYear && releaseYear !== '0000'
                ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" 
                : "bg-muted/50 border-border"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                Ano de Lançamento
              </span>
              {isEnriched && releaseYear && releaseYear !== '0000' && (
                <Sparkles className="w-3 h-3 text-green-600" />
              )}
            </div>
            <p className={cn(
              "text-sm font-semibold",
              releaseYear && releaseYear !== '0000' ? "text-foreground" : "text-muted-foreground italic"
            )}>
              {releaseYear && releaseYear !== '0000' ? releaseYear : 'Não identificado'}
            </p>
          </div>
        </div>

        {/* Metadados Secundários */}
        {(enrichmentSource || confidenceScore > 0) && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {enrichmentSource && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Fonte:</span>
                <span className="capitalize">{enrichmentSource}</span>
              </div>
            )}
            {confidenceScore > 0 && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Confiança:</span>
                <span className={cn(
                  confidenceScore >= 80 ? "text-green-600" : 
                  confidenceScore >= 50 ? "text-yellow-600" : "text-red-600"
                )}>
                  {confidenceScore}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Letra (Colapsável) */}
        {lyrics && (
          <Collapsible open={isLyricsOpen} onOpenChange={setIsLyricsOpen}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-between hover:bg-muted/50"
              >
                <span className="text-xs font-medium">
                  {isLyricsOpen ? 'Ocultar' : 'Ver'} Letra
                </span>
                {isLyricsOpen ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="bg-muted/30 rounded-lg p-3 max-h-60 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">
                  {lyrics}
                </pre>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
