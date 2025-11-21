import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artistId, artistName } = await req.json();
    
    if (!artistId || !artistName) {
      throw new Error('artistId and artistName are required');
    }

    console.log(`Enriching artist profile: ${artistName} (${artistId})`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Try Wikipedia first
    console.log(`Attempting Wikipedia search for: ${artistName}`);
    const wikipediaBio = await fetchWikipediaBio(artistName);

    let biography = '';
    let biographySource = '';

    if (wikipediaBio) {
      // Success with Wikipedia
      biography = `${wikipediaBio}\n\n(Fonte: Wikipédia)`;
      biographySource = 'wikipedia';
      console.log(`✅ Wikipedia biography found for ${artistName}`);
    } else {
      // Step 2: Fallback to Lovable AI (Gemini)
      console.log(`⏭️ Wikipedia not found, proceeding to Lovable AI (Gemini) fallback`);
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (!LOVABLE_API_KEY) {
        console.error('❌ LOVABLE_API_KEY not configured - cannot proceed with fallback');
        throw new Error('LOVABLE_API_KEY is not configured');
      }

      console.log('✓ Lovable API key found, calling AI...');
      const aiBio = await fetchAIBiography(artistName, LOVABLE_API_KEY);
      biography = `${aiBio}\n\n(Fonte: IA Generativa)`;
      biographySource = 'ai';
      console.log(`✅ AI biography generated for ${artistName}`);
    }

    // Update artist record in database
    const { error: updateError } = await supabase
      .from('artists')
      .update({
        biography,
        biography_source: biographySource,
        updated_at: new Date().toISOString()
      })
      .eq('id', artistId);

    if (updateError) {
      console.error('Error updating artist:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        artistId,
        biography,
        source: biographySource
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in enrich-artist-profile:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

/**
 * Fetch artist biography from Portuguese Wikipedia
 * Returns the summary text or null if not found
 */
async function fetchWikipediaBio(artistName: string): Promise<string | null> {
  try {
    // Encode artist name for URL
    const encodedName = encodeURIComponent(artistName);
    const url = `https://pt.wikipedia.org/api/rest_v1/page/summary/${encodedName}`;
    
    console.log(`Fetching Wikipedia: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MusicEnrichmentBot/1.0'
      }
    });

    if (response.status === 404) {
      console.log(`Wikipedia: Page not found for "${artistName}"`);
      return null;
    }

    if (!response.ok) {
      console.error(`Wikipedia API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Check if we have a valid extract
    if (data.extract && data.extract.trim()) {
      console.log(`✅ Wikipedia extract found (${data.extract.length} chars)`);
      return data.extract;
    }

    return null;

  } catch (error) {
    console.error('Error fetching Wikipedia:', error);
    return null;
  }
}


/**
 * Final Fallback: Use AI to generate biography with strict anti-hallucination prompt
 */
async function fetchAIBiography(artistName: string, apiKey: string): Promise<string> {
  const prompt = `Você é uma enciclopédia factual especializada em música brasileira.

Resuma a carreira do artista musical "${artistName}".

REGRAS CRÍTICAS:
1. Se você NÃO tiver informações CONFIÁVEIS e VERIFICADAS sobre este artista específico, responda APENAS: "Biografia não disponível no momento"
2. NÃO invente fatos, datas, álbuns, prêmios ou colaborações
3. NÃO confunda com outros artistas de nome similar
4. Se tiver dúvida, seja conservador e admita a falta de informação
5. Foque em fatos verificáveis: carreira musical, gênero, período de atividade
6. Máximo de 3-4 parágrafos

Retorne APENAS o texto da biografia, sem introduções ou explicações adicionais.`;

  try {
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
        temperature: 0.3,
        max_tokens: 800
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return 'Biografia temporariamente indisponível (limite de requisições atingido). Tente novamente em alguns instantes.';
      }
      
      if (response.status === 402) {
        return 'Biografia temporariamente indisponível (créditos insuficientes).';
      }
      
      return 'Biografia não disponível no momento.';
    }

    const data = await response.json();
    const biography = data.choices?.[0]?.message?.content || 'Biografia não disponível no momento.';
    
    return biography.trim();

  } catch (error) {
    console.error('Error generating AI biography:', error);
    return 'Biografia não disponível no momento.';
  }
}
