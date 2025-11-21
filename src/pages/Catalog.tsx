import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Music, Users, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Artist {
  id: string;
  name: string;
  genre: string | null;
  created_at: string;
}

interface Song {
  id: string;
  title: string;
  composer: string | null;
  release_year: string | null;
  lyrics: string | null;
  status: string;
  enrichment_source: string | null;
  confidence_score: number;
  created_at: string;
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-gray-500' },
  enriching: { label: 'Enriquecendo', color: 'bg-blue-500' },
  enriched: { label: 'Enriquecido', color: 'bg-green-500' },
  approved: { label: 'Aprovado', color: 'bg-purple-500' },
  rejected: { label: 'Rejeitado', color: 'bg-red-500' }
};

export default function Catalog() {
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);

  // Query para artistas
  const { data: artists, isLoading: loadingArtists } = useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Artist[];
    }
  });

  // Query para músicas do artista selecionado
  const { data: songs, isLoading: loadingSongs } = useQuery({
    queryKey: ['songs', selectedArtistId],
    queryFn: async () => {
      if (!selectedArtistId) return [];
      
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_id', selectedArtistId)
        .order('title');
      
      if (error) throw error;
      return data as Song[];
    },
    enabled: !!selectedArtistId
  });

  // Query para contar músicas por artista
  const { data: songCounts } = useQuery({
    queryKey: ['song-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('artist_id');
      
      if (error) throw error;
      
      const counts = data.reduce((acc, song) => {
        acc[song.artist_id] = (acc[song.artist_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return counts;
    }
  });

  // Selecionar primeiro artista automaticamente
  useEffect(() => {
    if (artists && artists.length > 0 && !selectedArtistId) {
      setSelectedArtistId(artists[0].id);
    }
  }, [artists, selectedArtistId]);

  if (loadingArtists) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  if (!artists || artists.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center max-w-md">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Catálogo Vazio</h2>
          <p className="text-muted-foreground mb-4">
            Nenhum artista encontrado. Importe um arquivo Excel para começar.
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Importar Dados
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar de Artistas */}
      <div className="w-80 border-r bg-muted/30">
        <div className="p-4 border-b bg-background">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Artistas ({artists.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Selecione para ver músicas
          </p>
        </div>
        
        <ScrollArea className="h-[calc(100vh-73px)]">
          <div className="p-2">
            {artists.map((artist) => (
              <Button
                key={artist.id}
                variant={selectedArtistId === artist.id ? 'default' : 'ghost'}
                className="w-full justify-start mb-1 h-auto py-3"
                onClick={() => setSelectedArtistId(artist.id)}
              >
                <div className="flex flex-col items-start w-full">
                  <span className="font-medium truncate w-full text-left">
                    {artist.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {songCounts?.[artist.id] || 0} músicas
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Área Principal - Músicas */}
      <div className="flex-1 overflow-hidden">
        {selectedArtistId && (
          <>
            {/* Header */}
            <div className="p-6 border-b bg-background">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Music className="w-6 h-6" />
                    {artists.find(a => a.id === selectedArtistId)?.name}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    {songs?.length || 0} músicas no catálogo
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    Exportar
                  </Button>
                  <Button size="sm">
                    Enriquecer Todas
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de Músicas */}
            <ScrollArea className="h-[calc(100vh-121px)]">
              {loadingSongs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : songs && songs.length > 0 ? (
                <div className="p-6 space-y-3">
                  {songs.map((song) => {
                    const statusInfo = statusConfig[song.status as keyof typeof statusConfig] || statusConfig.pending;
                    
                    return (
                      <Card key={song.id} className="p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{song.title}</h3>
                              <Badge className={statusInfo.color}>
                                {statusInfo.label}
                              </Badge>
                              {song.confidence_score > 0 && (
                                <Badge variant="outline">
                                  {song.confidence_score}% confiança
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                              {song.composer && (
                                <div>
                                  <span className="font-medium">Compositor:</span> {song.composer}
                                </div>
                              )}
                              {song.release_year && (
                                <div>
                                  <span className="font-medium">Ano:</span> {song.release_year}
                                </div>
                              )}
                              {song.enrichment_source && (
                                <div>
                                  <span className="font-medium">Fonte:</span> {song.enrichment_source}
                                </div>
                              )}
                            </div>

                            {song.lyrics && (
                              <>
                                <Separator className="my-3" />
                                <details className="text-sm">
                                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Ver letra
                                  </summary>
                                  <pre className="mt-2 whitespace-pre-wrap text-xs bg-muted/50 p-3 rounded">
                                    {song.lyrics}
                                  </pre>
                                </details>
                              </>
                            )}
                          </div>
                          
                          <div className="ml-4 flex gap-2">
                            <Button variant="outline" size="sm">
                              Editar
                            </Button>
                            {song.status === 'pending' && (
                              <Button size="sm">
                                Enriquecer
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Music className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Nenhuma música encontrada para este artista
                    </p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}
