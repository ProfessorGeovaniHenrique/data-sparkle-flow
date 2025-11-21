import { useState } from 'react';
import { Music, Sparkles, Loader2, Eye, Trash2 } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';

interface ArtistCardProps {
  id: string;
  name: string;
  genre: string | null;
  totalSongs: number;
  pendingSongs: number;
  enrichedPercentage: number;
  onViewDetails: () => void;
  onEnrich: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ArtistCard({
  id,
  name,
  genre,
  totalSongs,
  pendingSongs,
  enrichedPercentage,
  onViewDetails,
  onEnrich,
  onDelete
}: ArtistCardProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEnrich = async () => {
    setIsEnriching(true);
    try {
      await onEnrich();
    } finally {
      setIsEnriching(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg truncate flex-1" title={name}>
            {name}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            {genre && (
              <Badge variant="outline">
                {genre}
              </Badge>
            )}
            
            <AlertDialog>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive cursor-pointer">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir artista
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso irá excluir permanentemente o artista "{name}" e todas as suas {totalSongs} músicas do catálogo. 
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Excluindo...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Excluir permanentemente
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
