export type MusicStatus = 
  | 'uploaded' 
  | 'processed' 
  | 'ready_for_enrichment' 
  | 'enriching' 
  | 'enriched' 
  | 'validating' 
  | 'validated' 
  | 'rejected';

export interface ProcessedMusicData {
  nome_musica: string;
  autor: string;
  letra: string;
}

export interface EnrichedMusicData {
  compositor?: string;
  ano_lancamento?: number;
  album?: string;
  genero?: string;
  gravadora?: string;
  pais_origem?: string;
}

export interface MusicData {
  id: string;
  status: MusicStatus;
  source_file: string;
  
  original_data: {
    [key: string]: any;
  };
  
  processed_data?: ProcessedMusicData;
  
  enriched_data?: EnrichedMusicData;
  
  created_at: string;
  processed_at?: string;
  enriched_at?: string;
  validated_at?: string;
  validation_notes?: string;
}

export interface CleaningStats {
  total_rows: number;
  duplicates_removed: number;
  links_removed: number;
  noise_cleaned: number;
  final_count: number;
}
