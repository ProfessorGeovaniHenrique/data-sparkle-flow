-- Criar tabela de cache para resultados do YouTube
CREATE TABLE IF NOT EXISTS public.youtube_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT NOT NULL UNIQUE,
  video_id TEXT NOT NULL,
  video_title TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  publish_date TEXT NOT NULL,
  description TEXT,
  hits_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar índice para busca rápida por query
CREATE INDEX idx_youtube_cache_search_query ON public.youtube_cache(search_query);

-- Criar índice para limpeza de cache antigo
CREATE INDEX idx_youtube_cache_created_at ON public.youtube_cache(created_at);

-- Habilitar RLS (permitir acesso para service role)
ALTER TABLE public.youtube_cache ENABLE ROW LEVEL SECURITY;

-- Policy para permitir acesso total (já que será usado apenas por edge functions)
CREATE POLICY "Allow all access to youtube_cache"
  ON public.youtube_cache
  FOR ALL
  USING (true);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_youtube_cache_updated_at
  BEFORE UPDATE ON public.youtube_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Comentários para documentação
COMMENT ON TABLE public.youtube_cache IS 'Cache de resultados da YouTube Data API para economizar quota';
COMMENT ON COLUMN public.youtube_cache.search_query IS 'Query de busca normalizada (titulo + artista + "official audio")';
COMMENT ON COLUMN public.youtube_cache.hits_count IS 'Número de vezes que este cache foi reutilizado';
COMMENT ON COLUMN public.youtube_cache.created_at IS 'Data da primeira busca no YouTube';
COMMENT ON COLUMN public.youtube_cache.updated_at IS 'Data da última vez que o cache foi acessado';