import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiter simples
class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;
  private maxConcurrent: number;
  private minDelay: number;
  private lastRequestTime = 0;

  constructor(maxConcurrent: number, minDelayMs: number) {
    this.maxConcurrent = maxConcurrent;
    this.minDelay = minDelayMs;
  }

  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Garantir delay mínimo entre requisições
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minDelay) {
            await new Promise(r => setTimeout(r, this.minDelay - timeSinceLastRequest));
          }
          
          this.lastRequestTime = Date.now();
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.running--;
          this.processQueue();
        }
      });
      this.processQueue();
    });
  }

  private processQueue() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.running++;
        task();
      }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const mode = body.mode || 'legacy';
    
    // Suporta formato legado e novo modo database
    let musicsToProcess: Array<{ id?: string; titulo: string; artista?: string }> = [];
    let artistName: string | undefined;
    let supabaseClient: any;
    
    // Modo Database: busca músicas pendentes do Supabase
    if (mode === 'database' && body.artistId) {
      console.log(`[Database Mode] Enriching songs for artist ID: ${body.artistId}`);
      
      // Criar cliente Supabase
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      supabaseClient = createClient(supabaseUrl, supabaseKey);
      
      // Buscar nome do artista
      const { data: artistData, error: artistError } = await supabaseClient
        .from('artists')
        .select('name')
        .eq('id', body.artistId)
        .single();
      
      if (artistError) {
        throw new Error(`Artista não encontrado: ${artistError.message}`);
      }
      
      artistName = artistData.name;
      console.log(`[Database Mode] Artist name: ${artistName}`);
      
      // Buscar até 20 músicas pendentes
      const { data: songsData, error: songsError } = await supabaseClient
        .from('songs')
        .select('id, title')
        .eq('artist_id', body.artistId)
        .eq('status', 'pending')
        .limit(20);
      
      if (songsError) {
        throw new Error(`Erro ao buscar músicas: ${songsError.message}`);
      }
      
      if (!songsData || songsData.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true,
            message: 'Nenhuma música pendente encontrada',
            processed: 0,
            successCount: 0
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }
      
      musicsToProcess = songsData.map((song: any) => ({
        id: song.id,
        titulo: song.title,
        artista: artistName
      }));
      
      console.log(`[Database Mode] Found ${musicsToProcess.length} pending songs`);
      
    } else if (body.titles && Array.isArray(body.titles)) {
      // Formato legado: apenas lista de títulos
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
      throw new Error('Formato de payload inválido. Esperado { mode: "database", artistId: "..." } ou { titles: string[] } ou { musics: [{id, titulo, artista}] }');
    }
    
    console.log(`Starting enrichment for ${musicsToProcess.length} items`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Criar rate limiter: 5 requisições paralelas, 200ms de delay mínimo entre elas
    const rateLimiter = new RateLimiter(5, 200);
    const enrichedData = [];
    let successCount = 0;
    let failureCount = 0;
    
    // Processar todas as músicas em paralelo (limitado pelo rate limiter)
    const enrichmentPromises = musicsToProcess.map(async (music, i) => {
      try {
        return await rateLimiter.schedule(async () => {
          console.log(`Enriching ${i + 1}/${musicsToProcess.length}: ${music.titulo}`);
          
          // ============ BUSCAR NO YOUTUBE PRIMEIRO (RAG) ============
          let youtubeData: YouTubeSearchResult | null = null;
          try {
            youtubeData = await searchYouTube(music.titulo, music.artista, supabaseClient);
          } catch (ytError) {
            console.error(`[YouTube] Erro ao buscar "${music.titulo}":`, ytError);
            // Continua sem YouTube
          }
          // ===========================================================
          
          // Passar contexto YouTube para a IA
          const metadata = await enrichSingleTitle(
            music.titulo, 
            LOVABLE_API_KEY, 
            music.artista, 
            artistName,
            youtubeData || undefined
          );
          
          let validatedData = validateAndNormalizeMusicData({
            id: music.id,
            titulo_original: music.titulo,
            artista: metadata.artista,
            compositor: metadata.compositor,
            ano: metadata.ano,
            observacoes: metadata.observacoes
          });
          
          // Se YouTube foi usado, adicionar nota
          if (youtubeData) {
            const ytNote = `Contexto do YouTube: "${youtubeData.videoTitle}" (${youtubeData.channelTitle})`;
            validatedData.observacoes = validatedData.observacoes 
              ? `${validatedData.observacoes}. ${ytNote}`
              : ytNote;
          }
          
          // Verificar se precisa de pesquisa web (fallback)
          const needsWebResearch = 
            validatedData.status_pesquisa === 'Não Encontrado' ||
            validatedData.compositor_encontrado === 'Não Identificado' ||
            validatedData.compositor_encontrado === '' ||
            validatedData.ano_lancamento === '0000';
          
          if (needsWebResearch) {
            console.log(`Acionando fallback de pesquisa web para: ${music.titulo}`);
            try {
              const webData = await searchWithPerplexity(music.titulo, music.artista);
              
              // Mesclar dados da web com dados existentes
              if (webData.compositor && webData.compositor !== 'Não Identificado') {
                validatedData.compositor_encontrado = webData.compositor;
              }
              if (webData.ano && webData.ano !== '0000') {
                validatedData.ano_lancamento = webData.ano;
              }
              
              // Atualizar status e observações
              if (webData.compositor !== 'Não Identificado' || webData.ano !== '0000') {
                validatedData.status_pesquisa = 'Sucesso (Web)';
                validatedData.enriched_by_web = true;
                const webNote = webData.fonte ? ` Fonte: ${webData.fonte}` : '';
                validatedData.observacoes = validatedData.observacoes 
                  ? `${validatedData.observacoes}. Dados encontrados via pesquisa web.${webNote}`
                  : `Dados encontrados via pesquisa web.${webNote}`;
              }
              
              console.log(`Pesquisa web concluída para: ${music.titulo}. Sucesso: ${webData.compositor !== 'Não Identificado' || webData.ano !== '0000'}`);
            } catch (webError) {
              console.error(`Falha na pesquisa web para "${music.titulo}":`, webError);
              // Continua com os dados originais se a pesquisa web falhar
            }
          }
          
          // MODO DATABASE: Atualizar diretamente no banco
          if (mode === 'database' && supabaseClient && music.id) {
            console.log(`[Database Mode] Updating song ${music.id} in database`);
            
            const enrichmentSource = validatedData.enriched_by_web ? 'web' : 'ai';
            
            const { error: updateError } = await supabaseClient
              .from('songs')
              .update({
                composer: validatedData.compositor_encontrado !== 'Não Identificado' 
                  ? validatedData.compositor_encontrado 
                  : null,
                release_year: validatedData.ano_lancamento !== '0000' 
                  ? validatedData.ano_lancamento 
                  : null,
                youtube_url: youtubeData?.videoId 
                  ? `https://www.youtube.com/watch?v=${youtubeData.videoId}`
                  : null,
                status: 'enriched',
                enrichment_source: enrichmentSource,
                confidence_score: validatedData.status_pesquisa === 'Sucesso' ? 95 : 
                                 validatedData.status_pesquisa === 'Parcial' ? 60 : 30
              })
              .eq('id', music.id);
            
            if (updateError) {
              console.error(`Error updating song ${music.id}:`, updateError);
              failureCount++;
            } else {
              console.log(`[Database Mode] Song ${music.id} updated successfully`);
              successCount++;
            }
          }
          
          return validatedData;
        });
      } catch (error) {
        console.error(`Error enriching title "${music.titulo}":`, error);
        failureCount++;
        return {
          id: music.id,
          titulo_original: music.titulo,
          artista_encontrado: 'Não Identificado',
          compositor_encontrado: 'Não Identificado',
          ano_lancamento: '0000',
          observacoes: `Erro na busca: ${error instanceof Error ? error.message : 'Desconhecido'}`,
          status_pesquisa: 'Falha'
        };
      }
    });

    // Aguardar conclusão de todas as promessas
    const results = await Promise.all(enrichmentPromises);
    enrichedData.push(...results);

    // Resposta diferente para modo database
    if (mode === 'database') {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Enriquecimento concluído',
          processed: musicsToProcess.length,
          successCount: successCount,
          failed: failureCount
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
    
    // Resposta legado para outros modos
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

async function enrichSingleTitle(
  titulo: string, 
  apiKey: string, 
  artistaContexto?: string, 
  artistaEspecifico?: string,
  youtubeContext?: YouTubeSearchResult
) {
  // Construir contexto do artista
  const contextoArtista = artistaEspecifico 
    ? `\n\n**CONTEXTO IMPORTANTE**: Você está analisando músicas do artista "${artistaEspecifico}". Todas as respostas devem considerar este contexto específico.`
    : (artistaContexto ? `\nArtista de Contexto (se disponível): ${artistaContexto}` : '');
  
  // Construir contexto do YouTube (se disponível)
  let contextoYouTube = '';
  if (youtubeContext) {
    const publishYear = new Date(youtubeContext.publishDate).getFullYear();
    
    contextoYouTube = `

**🎬 CONTEXTO FACTUAL DO YOUTUBE (DADOS OFICIAIS):**
- Título do Vídeo: "${youtubeContext.videoTitle}"
- Canal: ${youtubeContext.channelTitle}
- Data de Publicação: ${youtubeContext.publishDate} (ANO: ${publishYear})
- Link: https://youtube.com/watch?v=${youtubeContext.videoId}

**Descrição do Vídeo (BUSQUE CRÉDITOS AQUI):**
${youtubeContext.description.substring(0, 800)}${youtubeContext.description.length > 800 ? '...' : ''}

**INSTRUÇÕES ESPECIAIS:**
• Use o ANO da data de publicação (${publishYear}) como forte referência para o campo "ano"
• Procure por padrões de créditos na descrição:
  - "Provided to YouTube by [distribuidor]"
  - "Composer:" ou "Compositor:"
  - "℗ [ano] [gravadora]"
  - "Written by:" ou "Letra:"
• DÊ PRIORIDADE aos dados encontrados na descrição do YouTube se parecerem oficiais
`;
  }
  
  const prompt = `Atue como um arquivista musical especialista em música brasileira, com profundo conhecimento em gêneros nordestinos (Forró, Piseiro, Baião, Xote, Arrocha).

**ENTRADA:**

Música: "${titulo}"${contextoArtista}${contextoYouTube}

**TAREFA:**
Analise os dados fornecidos e o contexto do YouTube (se houver) para determinar com precisão:
1. **Artista/Intérprete** da versão analisada
2. **Compositor(es)** original(is) da obra
3. **Ano de Lançamento** original da música (não do vídeo)

**REGRAS CRÍTICAS:**

1. **Contexto de Gênero:** Priorize o universo do Forró/Piseiro/Sertanejo Nordestino
2. **Covers:** Se for regravação, retorne o intérprete da versão + compositor original
3. **Créditos YouTube:** DÊ PRIORIDADE aos créditos oficiais na descrição do vídeo
4. **Ano de Lançamento:** Busque o ano ORIGINAL da música, não da data de upload do vídeo (exceto se for vídeo oficial de lançamento)
5. **Formato de Ano:** APENAS 4 dígitos (ex: "2015"). Use "0000" se desconhecido
6. **Dados Ausentes:** Use "Não Identificado" se não tiver certeza. NÃO invente

**FORMATO DE RESPOSTA (JSON Puro, sem markdown):**
{
  "artista": "Nome do Intérprete",
  "compositor": "Nome(s) do(s) Compositor(es)",
  "ano": "YYYY",
  "observacoes": "Breve explicação de onde tirou a informação (ex: 'Descrição do vídeo oficial')"
}`;

  // ============ USAR GEMINI 1.5 PRO DIRETAMENTE ============
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  
  if (GEMINI_API_KEY) {
    console.log('🧠 [Gemini Pro] Usando API própria do Google Gemini 1.5 Pro');
    
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'object',
              properties: {
                artista: { type: 'string' },
                compositor: { type: 'string' },
                ano: { type: 'string' },
                observacoes: { type: 'string' }
              },
              required: ['artista', 'compositor', 'ano']
            }
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [Gemini Pro] API error:', response.status, errorText);
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!textContent) {
        throw new Error('Gemini response sem conteúdo de texto');
      }

      // Parse JSON response
      const parsed = JSON.parse(textContent);
      console.log('✅ [Gemini Pro] Metadata extraída com sucesso');
      
      return {
        artista: parsed.artista || 'Não Identificado',
        compositor: parsed.compositor || 'Não Identificado',
        ano: parsed.ano || '0000',
        observacoes: parsed.observacoes || ''
      };
      
    } catch (geminiError) {
      console.error('❌ [Gemini Pro] Erro, fazendo fallback para Lovable AI:', geminiError);
      // Continua para fallback abaixo
    }
  }
  
  // ============ FALLBACK: LOVABLE AI GATEWAY ============
  console.log('🔄 [Fallback] Usando Lovable AI Gateway');
  
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

// ============= YOUTUBE DATA API INTEGRATION =============
interface YouTubeSearchResult {
  videoTitle: string;
  channelTitle: string;
  publishDate: string;
  description: string;
  videoId: string;
}

async function searchYouTube(
  titulo: string, 
  artista?: string,
  supabaseClient?: any
): Promise<YouTubeSearchResult | null> {
  const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
  
  // Fallback silencioso se key não estiver configurada
  if (!YOUTUBE_API_KEY) {
    console.warn('⚠️ YOUTUBE_API_KEY não configurada. Pulando busca no YouTube.');
    return null;
  }

  // Construir query otimizada para resultados oficiais
  const artistaInfo = artista ? ` ${artista}` : '';
  const searchQuery = `${titulo}${artistaInfo} official audio`;
  
  // ============ VERIFICAR CACHE PRIMEIRO ============
  if (supabaseClient) {
    try {
      const { data: cachedData, error: cacheError } = await supabaseClient
        .from('youtube_cache')
        .select('*')
        .eq('search_query', searchQuery)
        .single();
      
      if (!cacheError && cachedData) {
        console.log(`💾 [YouTube Cache] HIT: "${searchQuery}" (usado ${cachedData.hits_count} vezes)`);
        
        // Incrementar contador de hits e atualizar timestamp
        await supabaseClient
          .from('youtube_cache')
          .update({ 
            hits_count: cachedData.hits_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', cachedData.id);
        
        // Retornar dados do cache
        return {
          videoTitle: cachedData.video_title,
          channelTitle: cachedData.channel_title,
          publishDate: cachedData.publish_date,
          description: cachedData.description || '',
          videoId: cachedData.video_id
        };
      }
      
      console.log(`🔍 [YouTube Cache] MISS: "${searchQuery}" - Buscando na API...`);
    } catch (error) {
      console.error('⚠️ [YouTube Cache] Erro ao verificar cache:', error);
      // Continua com a busca na API
    }
  }
  // ==================================================
  
  console.log(`🔎 [YouTube API] Buscando: "${searchQuery}"`);

  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.append('part', 'snippet');
    url.searchParams.append('q', searchQuery);
    url.searchParams.append('type', 'video');
    url.searchParams.append('maxResults', '1');
    url.searchParams.append('key', YOUTUBE_API_KEY);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    // Tratamento especial para quota exceeded
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      
      if (errorData?.error?.errors?.[0]?.reason === 'quotaExceeded') {
        console.error('❌ [YouTube] Quota diária excedida (10,000 unidades). Continuando sem YouTube...');
        return null; // Fallback silencioso
      }
    }

    if (!response.ok) {
      console.error(`❌ [YouTube] HTTP ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = await response.json();
    const firstResult = data.items?.[0];

    if (!firstResult) {
      console.log(`ℹ️ [YouTube] Nenhum resultado encontrado para: "${searchQuery}"`);
      return null;
    }

    const snippet = firstResult.snippet;
    const result: YouTubeSearchResult = {
      videoTitle: snippet.title,
      channelTitle: snippet.channelName || snippet.channelTitle,
      publishDate: snippet.publishedAt, // ISO 8601 format
      description: snippet.description,
      videoId: firstResult.id.videoId
    };

    console.log(`✅ [YouTube API] Encontrado: "${result.videoTitle}" (${result.channelTitle})`);
    
    // ============ SALVAR NO CACHE ============
    if (supabaseClient) {
      try {
        await supabaseClient
          .from('youtube_cache')
          .insert({
            search_query: searchQuery,
            video_id: result.videoId,
            video_title: result.videoTitle,
            channel_title: result.channelTitle,
            publish_date: result.publishDate,
            description: result.description,
            hits_count: 0
          });
        
        console.log(`💾 [YouTube Cache] Resultado salvo no cache`);
      } catch (cacheError: any) {
        // Ignorar erro de duplicata (race condition)
        if (!cacheError?.message?.includes('duplicate')) {
          console.error('⚠️ [YouTube Cache] Erro ao salvar cache:', cacheError);
        }
      }
    }
    // =========================================
    
    return result;

  } catch (error) {
    console.error('❌ [YouTube] Erro na busca:', error);
    return null; // Continua sem YouTube
  }
}
// ========================================================

async function searchWithPerplexity(titulo: string, artista?: string): Promise<{ compositor: string; ano: string; fonte?: string }> {
  const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
  if (!PERPLEXITY_API_KEY) {
    console.warn('PERPLEXITY_API_KEY não configurada. Pulando pesquisa web.');
    return { compositor: 'Não Identificado', ano: '0000' };
  }

  const artistaInfo = artista ? ` do artista "${artista}"` : '';
  const searchPrompt = `Pesquise na web informações precisas sobre a música "${titulo}"${artistaInfo}. 
  
Preciso encontrar:
1. O compositor (ou compositores) ORIGINAL(is) da música
2. O ano de lançamento ORIGINAL da música

IMPORTANTE:
- Se for um cover/regravação, quero os dados da versão ORIGINAL
- Retorne APENAS informações verificáveis
- Se não encontrar, retorne "Não Identificado" para compositor e "0000" para ano
- Foque em música brasileira, especialmente forró, piseiro, sertanejo

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "compositor": "Nome do Compositor",
  "ano": "YYYY",
  "fonte": "Nome da fonte onde encontrou (ex: Wikipedia, Dicionário Cravo Albin)"
}`;

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: 'Você é um pesquisador musical especialista em música brasileira. Retorne APENAS JSON válido, sem texto adicional.'
          },
          {
            role: 'user',
            content: searchPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return { compositor: 'Não Identificado', ano: '0000' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.warn('Nenhum conteúdo retornado pela Perplexity');
      return { compositor: 'Não Identificado', ano: '0000' };
    }

    // Tentar extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[0]);
      return {
        compositor: parsedData.compositor || 'Não Identificado',
        ano: validateYear(parsedData.ano),
        fonte: parsedData.fonte
      };
    }

    console.warn('Não foi possível extrair JSON da resposta da Perplexity:', content);
    return { compositor: 'Não Identificado', ano: '0000' };

  } catch (error) {
    console.error('Erro na pesquisa com Perplexity:', error);
    return { compositor: 'Não Identificado', ano: '0000' };
  }
}

function validateAndNormalizeMusicData(data: any): any {
  const normalized = {
    id: data.id,
    titulo_original: data.titulo_original,
    artista_encontrado: data.artista || 'Não Identificado',
    compositor_encontrado: data.compositor || 'Não Identificado',
    ano_lancamento: validateYear(data.ano),
    status_pesquisa: 'Sucesso',
    observacoes: data.observacoes || '',
    enriched_by_web: false
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