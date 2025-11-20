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
    const body = await req.json();
    
    // Suporta tanto formato antigo { titles: string[] } quanto novo { musics: [{id, titulo, artista}] }
    let musicsToProcess: Array<{ id?: string; titulo: string; artista?: string }> = [];
    
    if (body.titles && Array.isArray(body.titles)) {
      // Formato antigo: apenas lista de títulos
      musicsToProcess = body.titles.map((titulo: string, index: number) => ({
        id: `legacy-${index}`,
        titulo,
        artista: undefined
      }));
    } else if (body.musics && Array.isArray(body.musics)) {
      // Formato novo: objetos com id, titulo, artista_contexto
      musicsToProcess = body.musics.map((m: any) => ({
        id: m.id || `unknown-${Math.random()}`,
        titulo: m.titulo,
        artista: m.artista_contexto || m.artista
      }));
    } else {
      throw new Error('Formato de payload inválido. Esperado { titles: string[] } ou { musics: [{id, titulo, artista}] }');
    }
    
    console.log(`Starting enrichment for ${musicsToProcess.length} items`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const enrichedData = [];
    
    for (let i = 0; i < musicsToProcess.length; i++) {
      const music = musicsToProcess[i];
      console.log(`Enriching ${i + 1}/${musicsToProcess.length}: ${music.titulo}`);
      
      try {
        const metadata = await enrichSingleTitle(music.titulo, LOVABLE_API_KEY, music.artista);
        const validatedData = validateAndNormalizeMusicData({
          id: music.id,
          titulo_original: music.titulo,
          artista: metadata.artista,
          compositor: metadata.compositor,
          ano: metadata.ano,
          observacoes: metadata.observacoes
        });
        enrichedData.push(validatedData);
      } catch (error) {
        console.error(`Error enriching title "${music.titulo}":`, error);
        enrichedData.push({
          id: music.id,
          titulo_original: music.titulo,
          artista_encontrado: 'Não Identificado',
          compositor_encontrado: 'Não Identificado',
          ano_lancamento: '0000',
          observacoes: `Erro na busca: ${error instanceof Error ? error.message : 'Desconhecido'}`,
          status_pesquisa: 'Falha'
        });
      }
      
      // Add delay between requests to avoid rate limiting
      if (i < musicsToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        results: enrichedData,
        processedCount: enrichedData.length,
        successCount: enrichedData.filter(d => d.status_pesquisa === 'Sucesso').length,
        failureCount: enrichedData.filter(d => d.status_pesquisa === 'Falha').length
      }),
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

async function enrichSingleTitle(titulo: string, apiKey: string, artistaContexto?: string) {
  const contextoArtista = artistaContexto ? `\nArtista de Contexto (se disponível): ${artistaContexto}` : '';
  
  const prompt = `Você é um especialista em musicologia brasileira e catalogação de dados fonográficos, com foco profundo em gêneros nordestinos como Forró, Piseiro, Baião, Xote e Arrocha. Sua tarefa é atuar como um enriquecedor de metadados musicais de alta precisão.

Música: "${titulo}"${contextoArtista}

Para esta música, você deve realizar uma pesquisa mental em sua base de conhecimento para encontrar os dados mais precisos e retornar informações padronizadas.

REGRAS CRÍTICAS DE PROCESSAMENTO:

• Contexto de Gênero é Prioritário: Assuma sempre que as músicas pertencem ao universo do Forró/Piseiro/Sertanejo, a menos que seja impossível. Se o título for genérico (ex: "Tempo Perdido"), busque a versão de forró mais famosa, não a original de rock.

• Tratamento de Covers (Regravações):
  - Se a música for um cover claro de outro gênero (ex: "Vagalumes" do Polentinha do Arrocha, original do Luan Santana):
    * artista: O artista da versão de forró/arrocha (ex: "Polentinha do Arrocha")
    * compositor: O compositor original (ex: "Luan Santana")
    * observacoes: "Cover de [Artista Original]"

• Padronização de Nomes:
  - Use sempre "Nome Sobrenome" (ex: "Luiz Gonzaga"), nunca "Sobrenome, Nome"
  - Mantenha a capitalização correta (Title Case)

• Formato de Data Rígido:
  - O campo ano DEVE conter APENAS 4 dígitos numéricos (ex: 2020)
  - NÃO use: 20/01/2020, cerca de 2020, anos 90, desconhecido
  - Se não souber o ano exato, tente estimar a década (ex: 1990)
  - Se for impossível, retorne "0000"

• Tratamento de Dados Ausentes: Se não encontrar o artista ou compositor com certeza, retorne "Não Identificado". NÃO invente dados.

Seja preciso e consistente. Use seu conhecimento sobre música nordestina brasileira.`;

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
  
  const yearStr = String(year).trim();
  
  // If already 4 digits, validate range
  if (/^\d{4}$/.test(yearStr)) {
    const yearNum = parseInt(yearStr, 10);
    const currentYear = new Date().getFullYear();
    if (yearNum >= 1900 && yearNum <= currentYear + 1) {
      return yearStr;
    }
  }
  
  // Try to extract 4 digits from the string
  const match = yearStr.match(/\d{4}/);
  if (match) {
    const yearNum = parseInt(match[0], 10);
    const currentYear = new Date().getFullYear();
    if (yearNum >= 1900 && yearNum <= currentYear + 1) {
      return match[0];
    }
  }
  
  return '0000';
}

function validateAndNormalizeMusicData(data: any): any {
  const normalized = {
    id: data.id,
    titulo_original: data.titulo_original,
    artista_encontrado: data.artista || 'Não Identificado',
    compositor_encontrado: data.compositor || 'Não Identificado',
    ano_lancamento: validateYear(data.ano),
    status_pesquisa: 'Sucesso',
    observacoes: data.observacoes || ''
  };

  // Normaliza artista
  if (!normalized.artista_encontrado || 
      normalized.artista_encontrado.trim() === '' || 
      normalized.artista_encontrado.toLowerCase() === 'n/a' ||
      normalized.artista_encontrado.toLowerCase() === 'desconhecido') {
    normalized.artista_encontrado = 'Não Identificado';
    normalized.status_pesquisa = 'Parcial';
  }

  // Normaliza compositor
  if (!normalized.compositor_encontrado || 
      normalized.compositor_encontrado.trim() === '' || 
      normalized.compositor_encontrado.toLowerCase() === 'n/a' ||
      normalized.compositor_encontrado.toLowerCase() === 'desconhecido') {
    normalized.compositor_encontrado = 'Não Identificado';
  }

  // Valida ano e ajusta status
  if (normalized.ano_lancamento === '0000') {
    if (normalized.status_pesquisa === 'Sucesso') {
      normalized.status_pesquisa = 'Parcial';
    }
    if (normalized.observacoes) {
      normalized.observacoes += '. Ano não encontrado ou inválido';
    } else {
      normalized.observacoes = 'Ano não encontrado ou inválido';
    }
  }

  // Status final
  if (normalized.artista_encontrado === 'Não Identificado' && 
      normalized.ano_lancamento === '0000') {
    normalized.status_pesquisa = 'Não Encontrado';
  }

  return normalized;
}
