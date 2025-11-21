import { supabase } from '@/integrations/supabase/client';
import { ParsedMusic } from '@/lib/excelParser';

export interface IngestionProgress {
  phase: 'upload' | 'artists' | 'songs' | 'complete';
  current: number;
  total: number;
  message: string;
}

export interface IngestionResult {
  uploadId: string;
  artistsCreated: number;
  artistsExisting: number;
  songsInserted: number;
  songsDuplicated: number;
  errors: string[];
}

/**
 * Ingere dados parseados do Excel no Supabase
 * Cria registro de upload, normaliza artistas e insere músicas
 */
export async function ingestExcelData(
  parsedData: ParsedMusic[],
  filename: string,
  onProgress?: (progress: IngestionProgress) => void
): Promise<IngestionResult> {
  const errors: string[] = [];
  const result: IngestionResult = {
    uploadId: '',
    artistsCreated: 0,
    artistsExisting: 0,
    songsInserted: 0,
    songsDuplicated: 0,
    errors
  };

  try {
    // FASE 1: Criar registro de upload
    onProgress?.({
      phase: 'upload',
      current: 0,
      total: parsedData.length,
      message: 'Criando registro de upload...'
    });

    const { data: uploadData, error: uploadError } = await supabase
      .from('uploads')
      .insert({
        filename,
        total_rows: parsedData.length,
        processed_rows: 0,
        status: 'processing'
      })
      .select()
      .single();

    if (uploadError) throw new Error(`Erro ao criar upload: ${uploadError.message}`);
    result.uploadId = uploadData.id;

    // FASE 2: Processar artistas únicos
    onProgress?.({
      phase: 'artists',
      current: 0,
      total: parsedData.length,
      message: 'Processando artistas...'
    });

    // Obter lista única de artistas
    const uniqueArtists = [...new Set(parsedData.map(m => m.artista || 'Desconhecido'))];
    const artistIdMap = new Map<string, string>();

    for (const artistName of uniqueArtists) {
      try {
        // Buscar artista existente (pela coluna normalizada)
        const { data: existingArtist } = await supabase
          .from('artists')
          .select('id, name')
          .eq('name', artistName)
          .maybeSingle();

        if (existingArtist) {
          artistIdMap.set(artistName, existingArtist.id);
          result.artistsExisting++;
        } else {
          // Criar novo artista
          const { data: newArtist, error: artistError } = await supabase
            .from('artists')
            .insert({ name: artistName })
            .select()
            .single();

          if (artistError) {
            // Se erro for de unique constraint, buscar novamente (race condition)
            if (artistError.code === '23505') {
              const { data: raceArtist } = await supabase
                .from('artists')
                .select('id')
                .eq('name', artistName)
                .single();
              
              if (raceArtist) {
                artistIdMap.set(artistName, raceArtist.id);
                result.artistsExisting++;
              }
            } else {
              errors.push(`Erro ao criar artista "${artistName}": ${artistError.message}`);
            }
          } else {
            artistIdMap.set(artistName, newArtist.id);
            result.artistsCreated++;
          }
        }
      } catch (error: any) {
        errors.push(`Erro ao processar artista "${artistName}": ${error.message}`);
      }
    }

    // FASE 3: Inserir músicas em lote
    onProgress?.({
      phase: 'songs',
      current: 0,
      total: parsedData.length,
      message: 'Inserindo músicas...'
    });

    // Processar em lotes de 50 para evitar timeout
    const BATCH_SIZE = 50;
    for (let i = 0; i < parsedData.length; i += BATCH_SIZE) {
      const batch = parsedData.slice(i, i + BATCH_SIZE);
      
      const songsToInsert = batch
        .filter(music => {
          const artistId = artistIdMap.get(music.artista || 'Desconhecido');
          if (!artistId) {
            errors.push(`Artista não encontrado para música "${music.titulo}"`);
            return false;
          }
          return true;
        })
        .map(music => ({
          artist_id: artistIdMap.get(music.artista || 'Desconhecido')!,
          upload_id: uploadData.id,
          title: music.titulo,
          lyrics: music.letra || null,
          status: 'pending',
          raw_data: {
            original_titulo: music.titulo,
            original_artista: music.artista,
            original_letra: music.letra,
            id: music.id
          }
        }));

      try {
        // Usar upsert com ON CONFLICT para ignorar duplicatas
        const { data: insertedSongs, error: songsError } = await supabase
          .from('songs')
          .upsert(songsToInsert, {
            onConflict: 'artist_id,normalized_title',
            ignoreDuplicates: true
          })
          .select();

        if (songsError) {
          errors.push(`Erro ao inserir lote de músicas: ${songsError.message}`);
        } else {
          const inserted = insertedSongs?.length || 0;
          result.songsInserted += inserted;
          result.songsDuplicated += (songsToInsert.length - inserted);
        }
      } catch (error: any) {
        errors.push(`Erro ao processar lote de músicas: ${error.message}`);
      }

      onProgress?.({
        phase: 'songs',
        current: Math.min(i + BATCH_SIZE, parsedData.length),
        total: parsedData.length,
        message: `Inserindo músicas... ${Math.min(i + BATCH_SIZE, parsedData.length)}/${parsedData.length}`
      });
    }

    // FASE 4: Atualizar status do upload
    await supabase
      .from('uploads')
      .update({
        processed_rows: result.songsInserted,
        status: errors.length > 0 ? 'error' : 'completed'
      })
      .eq('id', uploadData.id);

    onProgress?.({
      phase: 'complete',
      current: parsedData.length,
      total: parsedData.length,
      message: 'Importação concluída!'
    });

    return result;
  } catch (error: any) {
    errors.push(`Erro crítico na ingestão: ${error.message}`);
    
    // Tentar marcar upload como erro
    if (result.uploadId) {
      await supabase
        .from('uploads')
        .update({ status: 'error' })
        .eq('id', result.uploadId);
    }
    
    throw new Error(errors.join('; '));
  }
}
