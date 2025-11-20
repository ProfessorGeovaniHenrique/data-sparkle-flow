import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { data } = await req.json();
    
    console.log('Processing music data, total rows:', data.length);
    
    // Step 1: Remove duplicates based on song name + author
    const uniqueMap = new Map();
    let duplicatesRemoved = 0;
    
    for (const row of data) {
      // Map various possible field names to standard fields
      const songName = cleanString(
        row['Letras das musicas'] || 
        row.nome_musica || 
        row['Nome da Música'] || 
        row.name || 
        row.Música || 
        ''
      );
      
      const author = cleanString(
        row.artistas || 
        row.autor || 
        row.Autor || 
        row.artist || 
        row.Artista || 
        ''
      );
      
      // Check if Música field contains lyrics (longer text) or song name
      const musicaField = row.Música || '';
      let letra = '';
      
      // If Música field is long (>100 chars), it's probably the lyrics
      if (musicaField.length > 100) {
        letra = musicaField;
      } else if (musicaField && !songName) {
        // If short and no song name found elsewhere, it's the song name
        const altSongName = cleanString(musicaField);
        const key = `${altSongName.toLowerCase()}_${author.toLowerCase()}`;
        
        if (!uniqueMap.has(key) && altSongName && author) {
          uniqueMap.set(key, { ...row, nome_musica: altSongName, autor: author });
        } else {
          duplicatesRemoved++;
        }
        continue;
      }
      
      const key = `${songName.toLowerCase()}_${author.toLowerCase()}`;
      
      if (!uniqueMap.has(key) && songName && author) {
        uniqueMap.set(key, { ...row, nome_musica: songName, autor: author, letra_temp: letra });
      } else {
        duplicatesRemoved++;
      }
    }
    
    // Step 2: Clean and structure data
    const processedData = [];
    let linksRemoved = 0;
    let noiseCleaned = 0;
    
    for (const [_, row] of uniqueMap) {
      // Get letra from various possible fields
      let letra = row.letra_temp || row.letra || row.Letra || row.lyrics || row.Música || '';
      
      // If letra is empty but Música field exists and is long, use it
      if (!letra && row.Música && row.Música.length > 100) {
        letra = row.Música;
      }
      
      // Remove links
      const originalLetra = letra;
      const cleanedLetra = removeLinks(String(letra));
      if (originalLetra !== cleanedLetra) linksRemoved++;
      
      // Remove noise
      const finalLetra = removeNoise(cleanedLetra);
      if (cleanedLetra !== finalLetra) noiseCleaned++;
      
      processedData.push({
        id: crypto.randomUUID(),
        nome_musica: row.nome_musica,
        autor: row.autor,
        letra: finalLetra,
        original_data: row,
        status: 'processed',
        created_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      });
    }
    
    console.log('Processing complete:', {
      total: data.length,
      duplicatesRemoved,
      linksRemoved,
      noiseCleaned,
      finalCount: processedData.length
    });
    
    return new Response(JSON.stringify({
      processed_data: processedData,
      stats: {
        total_rows: data.length,
        duplicates_removed: duplicatesRemoved,
        links_removed: linksRemoved,
        noise_cleaned: noiseCleaned,
        final_count: processedData.length,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing music data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function cleanString(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

function removeLinks(text: string): string {
  // Remove URLs (http://, https://, www.)
  return text.replace(/(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi, '');
}

function removeNoise(text: string): string {
  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, ' ');
  
  // Remove special characters that are likely noise (keep basic punctuation)
  cleaned = cleaned.replace(/[^\w\s\.,!?;:\-'\"()\[\]]/g, '');
  
  // Remove multiple consecutive punctuation
  cleaned = cleaned.replace(/([.,!?;:]){2,}/g, '$1');
  
  return cleaned.trim();
}
