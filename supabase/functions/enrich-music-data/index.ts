import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { titles } = await req.json();
    console.log(`Starting enrichment for ${titles.length} titles`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const enrichedData = [];
    
    for (let i = 0; i < titles.length; i++) {
      const titulo = titles[i];
      console.log(`Enriching ${i + 1}/${titles.length}: ${titulo}`);
      
      try {
        const metadata = await enrichSingleTitle(titulo, LOVABLE_API_KEY);
        enrichedData.push({
          titulo_original: titulo,
          artista_encontrado: metadata.artista || 'Não Identificado',
          compositor_encontrado: metadata.compositor || 'Não Identificado',
          ano_lancamento: validateYear(metadata.ano),
          observacoes: metadata.observacoes || '',
          status_pesquisa: 'Sucesso'
        });
      } catch (error) {
        console.error(`Error enriching title "${titulo}":`, error);
        enrichedData.push({
          titulo_original: titulo,
          artista_encontrado: 'Não Identificado',
          compositor_encontrado: 'Não Identificado',
          ano_lancamento: '0000',
          observacoes: 'Erro na busca',
          status_pesquisa: 'Falha'
        });
      }
      
      // Add delay between requests to avoid rate limiting
      if (i < titles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return new Response(
      JSON.stringify({ enrichedData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in enrich-music-data function:', error);
    
    if (error instanceof Response) {
      const errorText = await error.text();
      console.error('AI Gateway error response:', errorText);
      
      if (error.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (error.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function enrichSingleTitle(titulo: string, apiKey: string) {
  const prompt = `Você é um especialista em musicologia brasileira, com foco especial em gêneros nordestinos como Forró, Piseiro, Baião e Arrocha.

Música: "${titulo}"

Sua tarefa é identificar:
1. **Artista Principal**: O intérprete mais famoso desta música (priorize versões de Forró/Piseiro/Baião/Arrocha)
2. **Compositor(es)**: Os autores reais da obra musical
3. **Ano de Lançamento**: O ano da primeira gravação relevante (formato YYYY)

REGRAS CRÍTICAS:
- Se for um título genérico, assuma que é uma versão de Forró/Piseiro
- Se for um cover de outro gênero (Rock, Sertanejo), identifique o artista original como compositor, mas tente achar quem gravou a versão de forró
- Use seu conhecimento sobre música nordestina brasileira
- Seja preciso com os anos de lançamento
- Se não tiver certeza, indique "Não Identificado"

Adicione observações sobre ambiguidades se houver.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: prompt }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'enrich_music_info',
            description: 'Return structured music metadata for Brazilian Northeastern music',
            parameters: {
              type: 'object',
              properties: {
                artista: { 
                  type: 'string',
                  description: 'Nome do artista principal (intérprete). Use "Não Identificado" se desconhecido.'
                },
                compositor: { 
                  type: 'string',
                  description: 'Nome do(s) compositor(es) da música. Use "Não Identificado" se desconhecido.'
                },
                ano: { 
                  type: 'string',
                  description: 'Ano de lançamento no formato YYYY. Use "0000" se desconhecido.'
                },
                observacoes: {
                  type: 'string',
                  description: 'Notas sobre ambiguidades, covers, ou outras informações relevantes'
                }
              },
              required: ['artista', 'compositor', 'ano']
            }
          }
        }
      ],
      tool_choice: {
        type: 'function',
        function: { name: 'enrich_music_info' }
      }
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway error:', response.status, errorText);
    throw response;
  }

  const data = await response.json();
  
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }
  
  return {
    artista: 'Não Identificado',
    compositor: 'Não Identificado',
    ano: '0000',
    observacoes: ''
  };
}

function validateYear(year: any): string {
  if (!year) return '0000';
  
  const yearStr = String(year);
  
  // If already 4 digits, return as-is
  if (/^\d{4}$/.test(yearStr)) {
    return yearStr;
  }
  
  // Try to extract 4 digits from the string
  const match = yearStr.match(/\d{4}/);
  if (match) {
    return match[0];
  }
  
  return '0000';
}
