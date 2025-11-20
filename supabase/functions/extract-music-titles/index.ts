import * as XLSX from 'https://esm.sh/xlsx@0.18.5';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  console.log('Extract-music-titles function called');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing request...');
    const formData = await req.formData();
    const files = formData.getAll('files');
    console.log(`Received ${files.length} files`);
    
    const filesData: any[] = [];
    const allExtractedData: any[] = [];
    
    for (const file of files) {
      if (!(file instanceof File)) continue;
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetsData: any[] = [];
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length === 0) continue;
        
        const headers = jsonData[0] as any[];
        const detectedColumns = detectMusicColumns(jsonData, headers);
        
        if (!detectedColumns.musicColumn) {
          console.log(`No music column found in ${file.name} - ${sheetName}`);
          continue;
        }
        
        console.log(`Detected columns in ${file.name} - ${sheetName}:`, detectedColumns);
        
        // Extract data from detected columns
        const extractedItems: any[] = [];
        const preview: any[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          
          const musica = row[detectedColumns.musicColumn.index];
          if (!musica || typeof musica !== 'string' || !musica.trim()) continue;
          
          const item: any = {
            titulo: cleanTitle(musica),
            fonte: file.name
          };
          
          if (detectedColumns.artistColumn) {
            const artist = row[detectedColumns.artistColumn.index];
            if (artist && typeof artist === 'string') {
              item.artista = artist.trim();
            }
          }
          
          if (detectedColumns.lyricsColumn) {
            const lyrics = row[detectedColumns.lyricsColumn.index];
            if (lyrics && typeof lyrics === 'string') {
              item.letra = lyrics.trim();
            }
          }
          
          extractedItems.push(item);
          if (preview.length < 10) {
            preview.push(item);
          }
        }
        
        sheetsData.push({
          sheetName,
          detectedColumns,
          preview,
          count: extractedItems.length
        });
        
        allExtractedData.push(...extractedItems);
      }
      
      filesData.push({
        filename: file.name,
        sheets: sheetsData
      });
    }
    
    // Remove duplicates based on title
    const uniqueTitles = new Map<string, any>();
    allExtractedData.forEach(item => {
      if (!uniqueTitles.has(item.titulo)) {
        uniqueTitles.set(item.titulo, item);
      }
    });
    
    const extractedTitles = Array.from(uniqueTitles.values());
    
    const stats = {
      totalFiles: filesData.length,
      totalSheets: filesData.reduce((sum, f) => sum + f.sheets.length, 0),
      totalTitles: allExtractedData.length,
      uniqueTitles: extractedTitles.length
    };
    
    console.log(`Extraction complete:`, stats);
    
    return new Response(
      JSON.stringify({
        success: true,
        files: filesData,
        extractedTitles,
        stats
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
    
  } catch (error) {
    console.error('Error in extract-music-titles:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
        type: error?.constructor?.name
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function detectMusicColumns(data: any[][], headers: any[]) {
  if (data.length < 2) return {};
  
  const numColumns = Math.max(...data.map(row => row.length));
  const result: any = {};
  
  // Patterns for music column
  const musicPatterns = [
    /nome\s+da\s+musica:/i,
    /^m[uú]sica$/i,
    /^song$/i,
    /^t[ií]tulo$/i,
    /^title$/i,
    /^nome$/i
  ];
  
  // Patterns for artist column
  const artistPatterns = [
    /^artista/i,
    /^artist/i,
    /^int[eé]rprete/i,
    /^cantor/i,
    /^banda$/i
  ];
  
  // Patterns for lyrics column
  const lyricsPatterns = [
    /letra/i,
    /lyrics/i,
    /texto/i
  ];
  
  for (let colIndex = 0; colIndex < numColumns; colIndex++) {
    const headerName = headers[colIndex]?.toString()?.trim() || '';
    
    // Count non-empty cells in this column
    let count = 0;
    for (let rowIndex = 1; rowIndex < Math.min(data.length, 100); rowIndex++) {
      const cellValue = data[rowIndex][colIndex];
      if (cellValue && typeof cellValue === 'string' && cellValue.trim()) {
        count++;
      }
    }
    
    if (count < 3) continue; // Skip columns with too few entries
    
    // Check for music column
    if (!result.musicColumn) {
      // Check header name
      if (musicPatterns.some(p => p.test(headerName))) {
        result.musicColumn = { index: colIndex, name: headerName, count };
        continue;
      }
      
      // Check cell pattern (like "nome da musica: Title")
      let patternMatches = 0;
      for (let rowIndex = 1; rowIndex < Math.min(data.length, 50); rowIndex++) {
        const cellValue = data[rowIndex][colIndex];
        if (cellValue && typeof cellValue === 'string' && /nome\s+da\s+musica:/i.test(cellValue)) {
          patternMatches++;
        }
      }
      
      if (patternMatches >= count * 0.5) {
        result.musicColumn = { index: colIndex, name: headerName || 'Música', count };
        continue;
      }
    }
    
    // Check for artist column
    if (!result.artistColumn && artistPatterns.some(p => p.test(headerName))) {
      result.artistColumn = { index: colIndex, name: headerName, count };
      continue;
    }
    
    // Check for lyrics column
    if (!result.lyricsColumn && lyricsPatterns.some(p => p.test(headerName))) {
      result.lyricsColumn = { index: colIndex, name: headerName, count };
    }
  }
  
  return result;
}

function cleanTitle(raw: string): string {
  // Remove "nome da musica:" prefix (case-insensitive, flexible spaces)
  let cleaned = raw.replace(/nome\s+da\s+musica:\s*/i, '');
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  // Normalize internal spaces (multiple → single)
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned;
}
