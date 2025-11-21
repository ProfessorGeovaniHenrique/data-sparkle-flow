import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Music, Users, Loader2, Search, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from 'sonner';
import { ArtistCard } from '@/components/ArtistCard';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'pending' | 'recent'>('name');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const queryClient = useQueryClient();

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

  // Query para contar músicas por artista e status
  const { data: songStats } = useQuery({
    queryKey: ['song-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('songs')
        .select('artist_id, status');
      
      if (error) throw error;
      
      const stats: Record<string, { total: number; pending: number; enriched: number }> = {};
      
      data.forEach(song => {
        if (!stats[song.artist_id]) {
          stats[song.artist_id] = { total: 0, pending: 0, enriched: 0 };
        }
        stats[song.artist_id].total++;
        if (song.status === 'pending') {
          stats[song.artist_id].pending++;
        }
        if (song.status === 'enriched' || song.status === 'approved') {
          stats[song.artist_id].enriched++;
        }
      });
      
      return stats;
    }
  });

  // Supabase Realtime - Atualização em tempo real das músicas
  useEffect(() => {
    if (!selectedArtistId) return;

    console.log('[Realtime] Setting up subscription for artist:', selectedArtistId);

    const channel = supabase
      .channel(`songs-${selectedArtistId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'songs',
          filter: `artist_id=eq.${selectedArtistId}`
        },
        (payload) => {
          console.log('[Realtime] Song updated:', payload.new);
          
          // Atualizar cache local imediatamente
          queryClient.setQueryData(['songs', selectedArtistId], (oldData: Song[] | undefined) => {
            if (!oldData) return oldData;
            
            return oldData.map(song => 
              song.id === payload.new.id 
                ? { ...song, ...payload.new }
                : song
            );
          });
          
          // Invalidar stats para atualizar cards
          queryClient.invalidateQueries({ queryKey: ['song-stats'] });
          
          toast.success(`"${payload.new.title}" atualizada!`);
        }
      )
      .subscribe();

    return () => {
      console.log('[Realtime] Unsubscribing from channel');
      supabase.removeChannel(channel);
    };
  }, [selectedArtistId, queryClient]);

  // Função para enriquecer músicas pendentes de um artista
  const handleEnrichArtist = async (artistId: string) => {
    const stats = songStats?.[artistId];
    
    if (!stats || stats.pending === 0) {
      toast.info('Não há músicas pendentes para enriquecer');
      return;
    }
    
    toast.info(`Iniciando enriquecimento de ${stats.pending} músicas...`);
    
    try {
      const { data, error } = await supabase.functions.invoke('enrich-music-data', {
        body: {
          mode: 'database',
          artistId: artistId
        }
      });
      
      if (error) throw error;
      
      console.log('[Enrichment] Result:', data);
      
      toast.success(
        `Enriquecimento concluído! ${data.successCount} sucessos`,
        { duration: 5000 }
      );
      
      // Invalidar stats para atualizar cards
      queryClient.invalidateQueries({ queryKey: ['song-stats'] });
      
    } catch (error: any) {
      console.error('[Enrichment] Error:', error);
      toast.error(`Erro no enriquecimento: ${error.message}`);
    }
  };

  // Filtrar e ordenar artistas
  const filteredAndSortedArtists = useMemo(() => {
    if (!artists) return [];
    
    // Filtrar por busca
    let filtered = artists.filter(artist =>
      artist.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    // Ordenar
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'pending':
          const aPending = songStats?.[a.id]?.pending || 0;
          const bPending = songStats?.[b.id]?.pending || 0;
          return bPending - aPending; // Mais pendentes primeiro
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [artists, searchQuery, sortBy, songStats]);

  const handleViewDetails = (artistId: string) => {
    setSelectedArtistId(artistId);
    setIsSheetOpen(true);
  };

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
      <div className="flex items-center justify-center min-h-screen p-6">
        <Card className="p-8 text-center max-w-md">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Catálogo Vazio</h2>
          <p className="text-muted-foreground mb-4">
            Nenhum artista encontrado. Importe um arquivo Excel para começar.
          </p>
          <Button onClick={() => window.location.href = '/'}>
            <Upload className="w-4 h-4 mr-2" />
            Importar Dados
          </Button>
        </Card>
      </div>
    );
  }

  const selectedArtist = artists.find(a => a.id === selectedArtistId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Users className="w-8 h-8" />
                Catálogo de Artistas
              </h1>
              <p className="text-muted-foreground mt-1">
                {artists.length} artistas | {filteredAndSortedArtists.length} exibidos
              </p>
            </div>
            
            <Button onClick={() => window.location.href = '/'}>
              <Upload className="w-4 h-4 mr-2" />
              Novo Upload
            </Button>
          </div>

          {/* Busca e Filtros */}
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar artistas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">A-Z</SelectItem>
                <SelectItem value="pending">Mais Pendentes</SelectItem>
                <SelectItem value="recent">Recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Grid de Cards */}
      <div className="container mx-auto p-6">
        {filteredAndSortedArtists.length === 0 ? (
          <Card className="p-8 text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Nenhum artista encontrado com "{searchQuery}"
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredAndSortedArtists.map((artist) => {
              const stats = songStats?.[artist.id] || { total: 0, pending: 0, enriched: 0 };
              const enrichedPercentage = stats.total > 0 
                ? Math.round((stats.enriched / stats.total) * 100)
                : 0;
              
              return (
                <ArtistCard
                  key={artist.id}
                  id={artist.id}
                  name={artist.name}
                  genre={artist.genre}
                  totalSongs={stats.total}
                  pendingSongs={stats.pending}
                  enrichedPercentage={enrichedPercentage}
                  onViewDetails={() => handleViewDetails(artist.id)}
                  onEnrich={() => handleEnrichArtist(artist.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Sheet Lateral - Detalhes do Artista */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Music className="w-5 h-5" />
              {selectedArtist?.name}
            </SheetTitle>
            <SheetDescription>
              {songs?.length || 0} músicas no catálogo
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)] mt-6">
            {loadingSongs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : songs && songs.length > 0 ? (
              <div className="space-y-3 pr-4">
                {songs.map((song) => {
                  const statusInfo = statusConfig[song.status as keyof typeof statusConfig] || statusConfig.pending;
                  
                  return (
                    <Card key={song.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-semibold text-base flex-1">{song.title}</h3>
                          <Badge className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {song.composer && (
                            <div>
                              <span className="text-muted-foreground">Compositor:</span>
                              <p className="font-medium">{song.composer}</p>
                            </div>
                          )}
                          {song.release_year && (
                            <div>
                              <span className="text-muted-foreground">Ano:</span>
                              <p className="font-medium">{song.release_year}</p>
                            </div>
                          )}
                          {song.enrichment_source && (
                            <div>
                              <span className="text-muted-foreground">Fonte:</span>
                              <p className="font-medium">{song.enrichment_source}</p>
                            </div>
                          )}
                          {song.confidence_score > 0 && (
                            <div>
                              <span className="text-muted-foreground">Confiança:</span>
                              <p className="font-medium">{song.confidence_score}%</p>
                            </div>
                          )}
                        </div>

                        {song.lyrics && (
                          <>
                            <Separator />
                            <details className="text-sm">
                              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Ver letra
                              </summary>
                              <pre className="mt-2 whitespace-pre-wrap text-xs bg-muted/50 p-3 rounded max-h-40 overflow-y-auto">
                                {song.lyrics}
                              </pre>
                            </details>
                          </>
                        )}
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
                    Nenhuma música encontrada
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
