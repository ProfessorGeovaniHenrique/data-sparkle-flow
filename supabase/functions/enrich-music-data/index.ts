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
    const { songs } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log(`Enriching ${songs.length} songs`);
    
    const enrichedSongs = [];
    
    // Process in batches to avoid rate limits
    for (const song of songs) {
      try {
        const enrichedData = await enrichSingleSong(song, LOVABLE_API_KEY);
        enrichedSongs.push({
          ...song,
          enriched_data: enrichedData,
          status: 'enriched',
          enriched_at: new Date().toISOString(),
        });
        
        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error enriching song ${song.nome_musica}:`, error);
        
        // Check for rate limit or payment errors
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (errorMessage.includes('429')) {
          return new Response(JSON.stringify({ 
            error: 'Rate limit exceeded. Please wait a moment and try again.',
            code: 'RATE_LIMIT'
          }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        if (errorMessage.includes('402')) {
          return new Response(JSON.stringify({ 
            error: 'Payment required. Please add credits to your Lovable AI workspace.',
            code: 'PAYMENT_REQUIRED'
          }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        // If individual song fails, add it without enrichment
        enrichedSongs.push({
          ...song,
          status: 'processed', // Keep as processed if enrichment fails
          enrichment_error: errorMessage,
        });
      }
    }
    
    return new Response(JSON.stringify({ enriched_songs: enrichedSongs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in enrich-music-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function enrichSingleSong(song: any, apiKey: string) {
  const prompt = `Baseado nas informações da música "${song.nome_musica}" do autor "${song.autor}", retorne informações adicionais sobre esta música. Se não tiver certeza sobre alguma informação, deixe o campo vazio.`;
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em música. Forneça informações precisas sobre músicas quando solicitado. Se não souber alguma informação com certeza, não invente.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'enrich_music_info',
            description: 'Retorna informações adicionais sobre uma música',
            parameters: {
              type: 'object',
              properties: {
                compositor: {
                  type: 'string',
                  description: 'Nome do compositor da música (pode ser diferente do autor/intérprete)'
                },
                ano_lancamento: {
                  type: 'number',
                  description: 'Ano de lançamento da música'
                },
                album: {
                  type: 'string',
                  description: 'Nome do álbum onde a música foi lançada'
                },
                genero: {
                  type: 'string',
                  description: 'Gênero musical (ex: Pop, Rock, Samba, MPB, etc)'
                },
                gravadora: {
                  type: 'string',
                  description: 'Nome da gravadora que lançou a música'
                },
                pais_origem: {
                  type: 'string',
                  description: 'País de origem do artista/música'
                }
              },
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: 'function', function: { name: 'enrich_music_info' } }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway error:', response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract the tool call result
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall && toolCall.function.name === 'enrich_music_info') {
    return JSON.parse(toolCall.function.arguments);
  }
  
  return {};
}
