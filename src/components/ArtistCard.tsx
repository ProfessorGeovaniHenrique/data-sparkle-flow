import { useState } from 'react';
import { Music, Sparkles, Loader2, Eye } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface ArtistCardProps {
  id: string;
  name: string;
  genre: string | null;
  totalSongs: number;
  pendingSongs: number;
  enrichedPercentage: number;
  onViewDetails: () => void;
  onEnrich: () => Promise<void>;
}

export function ArtistCard({
  id,
  name,
  genre,
  totalSongs,
  pendingSongs,
  enrichedPercentage,
  onViewDetails,
  onEnrich
}: ArtistCardProps) {
  const [isEnriching, setIsEnriching] = useState(false);

  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      await onEnrich();
    } finally {
      setIsEnriching(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg truncate flex-1" title={name}>
            {name}
          </CardTitle>
          {genre && (
            <Badge variant="outline" className="ml-2 shrink-0">
              {genre}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Music className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="text-2xl font-bold">{totalSongs}</div>
          </div>

          <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-yellow-600" />
              <span className="text-xs text-muted-foreground">Pendentes</span>
            </div>
            <div className="text-2xl font-bold text-yellow-600">{pendingSongs}</div>
          </div>
        </div>

        {/* Barra de Progresso */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progresso de Enriquecimento</span>
            <span className="font-medium">{enrichedPercentage}%</span>
          </div>
          <Progress value={enrichedPercentage} className="h-2" />
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDetails}
          className="flex-1"
        >
          <Eye className="w-4 h-4 mr-2" />
          Ver Detalhes
        </Button>
        
        {pendingSongs > 0 && (
          <Button
            size="sm"
            onClick={handleEnrich}
            disabled={isEnriching}
            className="flex-1"
          >
            {isEnriching ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Enriquecer ({pendingSongs})
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
