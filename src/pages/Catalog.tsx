import { useEffect, useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Music, Users, Loader2, Search, Upload, Trash2, List, Clock, BookOpen, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ArtistCard } from '@/components/ArtistCard';
import { SongCard } from '@/components/SongCard';

interface Artist {
  id: string;
  name: string;
  genre: string | null;
  biography: string | null;
  biography_source: string | null;
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
  youtube_url: string | null;
  created_at: string;
  updated_at: string;
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
  const [recentlyEnrichedIds, setRecentlyEnrichedIds] = useState<Set<string>>(new Set());
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list');
  const [isEnrichingBio, setIsEnrichingBio] = useState(false);
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
  const { data: songsRaw, isLoading: loadingSongs } = useQuery({
    queryKey: ['songs', selectedArtistId],
    queryFn: async () => {
      if (!selectedArtistId) return [];
      
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('artist_id', selectedArtistId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data as Song[];
    },
    enabled: !!selectedArtistId,
    refetchOnMount: 'always' // Sempre buscar dados frescos ao abrir sheet
  });

  // Ordenar músicas: enriquecidas primeiro, depois por data de atualização
  const songs = useMemo(() => {
    if (!songsRaw) return [];
    
    return [...songsRaw].sort((a, b) => {
      // Prioridade 1: Status (enriched/approved > outros)
      const aIsEnriched = a.status === 'enriched' || a.status === 'approved';
      const bIsEnriched = b.status === 'enriched' || b.status === 'approved';
      
      if (aIsEnriched !== bIsEnriched) {
        return aIsEnriched ? -1 : 1; // Enriquecidas primeiro
      }
      
      // Prioridade 2: Mais recentes primeiro
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [songsRaw]);

  // Agrupar músicas por ano para a visualização Timeline
  const songsByYear = useMemo(() => {
    if (!songs) return { years: [], unknown: [] };
    
    const grouped: Record<string, Song[]> = {};
    const unknown: Song[] = [];
    
    songs.forEach(song => {
      const year = song.release_year;
      
      if (!year || year === '0000' || year.trim() === '') {
        unknown.push(song);
      } else {
        if (!grouped[year]) {
          grouped[year] = [];
        }
        grouped[year].push(song);
      }
    });
    
    // Ordenar anos em ordem decrescente (mais recente primeiro)
    const sortedYears = Object.keys(grouped).sort((a, b) => {
      const yearA = parseInt(a);
      const yearB = parseInt(b);
      return yearB - yearA;
    });
    
    return {
      years: sortedYears.map(year => ({
        year,
        songs: grouped[year]
      })),
      unknown
    };
  }, [songs]);

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
          
          // Marcar como recém-enriquecido se status mudou para enriched
          if (payload.new.status === 'enriched' && payload.old?.status === 'pending') {
            setRecentlyEnrichedIds(prev => new Set(prev).add(payload.new.id));
            
            // Remover destaque após 5 segundos
            setTimeout(() => {
              setRecentlyEnrichedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(payload.new.id);
                return newSet;
              });
            }, 5000);
          }
          
          // Atualizar cache local imediatamente
          queryClient.setQueryData(['songs', selectedArtistId], (oldData: Song[] | undefined) => {
            if (!oldData) return oldData;
            
            return oldData.map(song => 
              song.id === payload.new.id 
                ? { ...song, ...payload.new }
                : song
            );
          });
          
          // Invalidar ambas queries para sincronizar contagens
          console.log('[Query] Song atualizada via realtime, invalidando queries');
          queryClient.invalidateQueries({ queryKey: ['song-stats'] });
          queryClient.invalidateQueries({ queryKey: ['songs', selectedArtistId] });
          
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
      
      // Invalidar queries para atualizar cards E sheet
      console.log('[Query] Invalidando song-stats e songs para artist:', artistId);
      queryClient.invalidateQueries({ queryKey: ['song-stats'] });
      queryClient.invalidateQueries({ queryKey: ['songs', artistId] });
      
    } catch (error: any) {
      console.error('[Enrichment] Error:', error);
      toast.error(`Erro no enriquecimento: ${error.message}`);
    }
  };

  // Função para excluir um artista e suas músicas
  const handleDeleteArtist = async (artistId: string, artistName: string) => {
    try {
      // Primeiro, excluir todas as músicas do artista
      const { error: songsError } = await supabase
        .from('songs')
        .delete()
        .eq('artist_id', artistId);
      
      if (songsError) throw songsError;
      
      // Depois, excluir o artista
      const { error: artistError } = await supabase
        .from('artists')
        .delete()
        .eq('id', artistId);
      
      if (artistError) throw artistError;
      
      toast.success(`Artista "${artistName}" e suas músicas foram excluídos`);
      
      // Fechar sheet se estava aberto
      if (selectedArtistId === artistId) {
        setIsSheetOpen(false);
        setSelectedArtistId(null);
      }
      
      // Invalidar queries para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['song-stats'] });
      
    } catch (error: any) {
      console.error('[Delete] Error:', error);
      toast.error(`Erro ao excluir artista: ${error.message}`);
    }
  };

  // Função para limpar todo o banco de dados
  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    
    try {
      // Fechar sheet se estiver aberto
      if (isSheetOpen) {
        setIsSheetOpen(false);
        setSelectedArtistId(null);
      }

      // Deletar na ordem correta devido às foreign keys
      // 1. Deletar todas as músicas
      const { error: songsError } = await supabase
        .from('songs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo
      
      if (songsError) throw songsError;
      
      // 2. Deletar todos os artistas
      const { error: artistsError } = await supabase
        .from('artists')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo
      
      if (artistsError) throw artistsError;
      
      // 3. Deletar todos os uploads
      const { error: uploadsError } = await supabase
        .from('uploads')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo
      
      if (uploadsError) throw uploadsError;
      
      toast.success('Banco de dados limpo com sucesso!');
      
      // Invalidar todas as queries
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      queryClient.invalidateQueries({ queryKey: ['song-stats'] });
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      
    } catch (error: any) {
      console.error('[Delete All] Error:', error);
      toast.error(`Erro ao limpar banco: ${error.message}`);
    } finally {
      setIsDeletingAll(false);
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

  const handleEnrichBiography = async () => {
    if (!selectedArtistId || !selectedArtist) return;
    
    setIsEnrichingBio(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('enrich-artist-profile', {
        body: {
          artistId: selectedArtistId,
          artistName: selectedArtist.name
        }
      });

      if (error) throw error;

      toast.success(`Biografia de "${selectedArtist.name}" enriquecida com sucesso!`);
      
      // Invalidar query para recarregar dados do artista
      queryClient.invalidateQueries({ queryKey: ['artists'] });
      
    } catch (error) {
      console.error('Erro ao enriquecer biografia:', error);
      toast.error('Erro ao enriquecer biografia. Tente novamente.');
    } finally {
      setIsEnrichingBio(false);
    }
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
            
            <div className="flex gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeletingAll}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {isDeletingAll ? 'Limpando...' : 'Limpar Banco'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-2">
                      <p className="font-semibold text-destructive">
                        Esta ação não pode ser desfeita!
                      </p>
                      <p>
                        Isso irá excluir permanentemente:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Todos os {artists.length} artistas</li>
                        <li>Todas as músicas do catálogo</li>
                        <li>Todos os históricos de upload</li>
                      </ul>
                      <p className="text-sm mt-2">
                        Você precisará importar novamente uma planilha para ter dados.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAll}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Sim, excluir tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button onClick={() => window.location.href = '/'}>
                <Upload className="w-4 h-4 mr-2" />
                Novo Upload
              </Button>
            </div>
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
                  onDelete={() => handleDeleteArtist(artist.id, artist.name)}
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

          {/* Biografia do Artista */}
          {selectedArtist && (
            <div className="mt-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Biografia
                </h3>
                {!selectedArtist.biography && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEnrichBiography}
                    disabled={isEnrichingBio}
                    className="flex items-center gap-2"
                  >
                    {isEnrichingBio ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Buscar Biografia
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {selectedArtist.biography ? (
                <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {selectedArtist.biography}
                  </p>
                  
                  {selectedArtist.biography_source === 'wikipedia' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                      <a 
                        href={`https://pt.wikipedia.org/wiki/${encodeURIComponent(selectedArtist.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Ler artigo completo na Wikipédia
                      </a>
                    </div>
                  )}
                  
                  {selectedArtist.biography_source === 'web' && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-xs text-muted-foreground italic">
                        Biografia obtida através de pesquisa web atualizada
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Biografia ainda não disponível. Clique no botão acima para buscar.
                </p>
              )}
            </div>
          )}

          {loadingSongs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : songs && songs.length > 0 ? (
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'timeline')} className="mt-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list" className="flex items-center gap-2">
                  <List className="w-4 h-4" />
                  Lista
                </TabsTrigger>
                <TabsTrigger value="timeline" className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Linha do Tempo
                </TabsTrigger>
              </TabsList>

              {/* Visualização Lista */}
              <TabsContent value="list" className="mt-4">
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="space-y-3 pr-4">
                    {songs.map((song) => (
                      <SongCard
                        key={song.id}
                        title={song.title}
                        composer={song.composer}
                        releaseYear={song.release_year}
                        lyrics={song.lyrics}
                        status={song.status}
                        enrichmentSource={song.enrichment_source}
                        confidenceScore={song.confidence_score}
                        youtubeUrl={song.youtube_url}
                        isRecentlyEnriched={recentlyEnrichedIds.has(song.id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Visualização Timeline */}
              <TabsContent value="timeline" className="mt-4">
                <ScrollArea className="h-[calc(100vh-200px)]">
                  <div className="space-y-8 pr-4">
                    {/* Anos conhecidos */}
                    {songsByYear.years.map(({ year, songs: yearSongs }) => (
                      <div key={year} className="space-y-3">
                        {/* Cabeçalho do Ano - Sticky */}
                        <div className="sticky top-0 bg-background z-10 py-2 border-b-2 border-primary">
                          <h3 className="text-3xl font-bold text-primary flex items-center gap-2">
                            <Clock className="w-6 h-6" />
                            {year}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {yearSongs.length} {yearSongs.length === 1 ? 'música' : 'músicas'}
                          </p>
                        </div>
                        
                        {/* Músicas do Ano */}
                        <div className="space-y-3 pl-2">
                          {yearSongs.map((song) => (
                            <SongCard
                              key={song.id}
                              title={song.title}
                              composer={song.composer}
                              releaseYear={song.release_year}
                              lyrics={song.lyrics}
                              status={song.status}
                              enrichmentSource={song.enrichment_source}
                              confidenceScore={song.confidence_score}
                              youtubeUrl={song.youtube_url}
                              isRecentlyEnriched={recentlyEnrichedIds.has(song.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Data Desconhecida */}
                    {songsByYear.unknown.length > 0 && (
                      <div className="space-y-3">
                        <div className="sticky top-0 bg-background z-10 py-2 border-b-2 border-muted">
                          <h3 className="text-3xl font-bold text-muted-foreground flex items-center gap-2">
                            <Clock className="w-6 h-6" />
                            Data Desconhecida
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {songsByYear.unknown.length} {songsByYear.unknown.length === 1 ? 'música' : 'músicas'}
                          </p>
                        </div>
                        
                        <div className="space-y-3 pl-2">
                          {songsByYear.unknown.map((song) => (
                            <SongCard
                              key={song.id}
                              title={song.title}
                              composer={song.composer}
                              releaseYear={song.release_year}
                              lyrics={song.lyrics}
                              status={song.status}
                              enrichmentSource={song.enrichment_source}
                              confidenceScore={song.confidence_score}
                              youtubeUrl={song.youtube_url}
                              isRecentlyEnriched={recentlyEnrichedIds.has(song.id)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
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
        </SheetContent>
      </Sheet>
    </div>
  );
}
