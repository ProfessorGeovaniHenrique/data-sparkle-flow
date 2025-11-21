-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2. Criar função imutável para normalização de texto
CREATE OR REPLACE FUNCTION normalize_text(text) 
RETURNS TEXT 
LANGUAGE SQL 
IMMUTABLE 
STRICT 
AS $$
  SELECT lower(unaccent(trim($1)));
$$;

-- 3. Tabela de Uploads (Histórico de Importações)
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'completed' -- 'processing', 'completed', 'error'
);

-- 4. Tabela de Artistas (Catálogo Central)
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    normalized_name TEXT GENERATED ALWAYS AS (normalize_text(name)) STORED,
    genre TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_artist_name UNIQUE (normalized_name)
);

-- 5. Tabela de Músicas
CREATE TABLE songs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
    upload_id UUID REFERENCES uploads(id),
    
    -- Dados Principais
    title TEXT NOT NULL,
    normalized_title TEXT GENERATED ALWAYS AS (normalize_text(title)) STORED,
    
    -- Dados para Enriquecimento
    composer TEXT,
    release_year TEXT,
    lyrics TEXT,
    
    -- Controle de Estado
    status TEXT DEFAULT 'pending',
    enrichment_source TEXT,
    confidence_score INTEGER DEFAULT 0,
    
    -- Metadados Técnicos
    raw_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_song_per_artist UNIQUE (artist_id, normalized_title)
);

-- 6. Índices para Performance
CREATE INDEX idx_songs_status ON songs(status);
CREATE INDEX idx_songs_artist_id ON songs(artist_id);
CREATE INDEX idx_artists_normalized_name ON artists(normalized_name);
CREATE INDEX idx_songs_normalized_title ON songs(normalized_title);

-- 7. Trigger para updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_artists_updated_at
    BEFORE UPDATE ON artists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_songs_updated_at
    BEFORE UPDATE ON songs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Políticas de Segurança (RLS)
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access" ON uploads FOR ALL USING (true);
CREATE POLICY "Allow all access" ON artists FOR ALL USING (true);
CREATE POLICY "Allow all access" ON songs FOR ALL USING (true);