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

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      throw new Error('Nenhum título de música foi fornecido no corpo da requisição.');
    }

    console.log(`Recebidos ${titles.length} títulos para processamento.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Recebidos ${titles.length} títulos com sucesso.`,
        count: titles.length,
        data: titles
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Erro na função extract-music-titles:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Ocorreu um erro desconhecido ao processar a requisição.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
