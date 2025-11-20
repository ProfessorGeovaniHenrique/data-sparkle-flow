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
    
    console.log(`Processing ${files.length} files for title extraction`);
    
    const allTitles: string[] = [];
    const detectionResults: any[] = [];
    
    for (const file of files) {
      if (!(file instanceof File)) continue;
      
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length === 0) continue;
        
        // Find the column with "nome da musica:" pattern
        const headers = jsonData[0] as any[];
        const columnIndex = findMusicTitleColumn(jsonData);
        
        if (columnIndex === -1) {
          console.log(`No "nome da musica:" pattern found in sheet ${sheetName}`);
          continue;
        }
        
        console.log(`Found target column at index ${columnIndex} in sheet ${sheetName}`);
        
        // Extract all values from the target column
        const extractedTitles: string[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          const rawValue = row[columnIndex];
          
          if (rawValue && typeof rawValue === 'string' && rawValue.trim()) {
            extractedTitles.push(rawValue);
          }
        }
        
        detectionResults.push({
          file: file.name,
          sheet: sheetName,
          columnIndex,
          columnName: headers[columnIndex],
          titlesFound: extractedTitles.length
        });
        
        allTitles.push(...extractedTitles);
      }
    }
    
    // Clean all extracted titles
    const cleanedTitles = allTitles.map(cleanTitle).filter(t => t.length > 0);
    
    // Remove duplicates
    const uniqueTitles = [...new Set(cleanedTitles)];
    
    console.log(`Extraction complete: ${allTitles.length} raw, ${uniqueTitles.length} unique clean titles`);
    
    return new Response(
      JSON.stringify({
        rawCount: allTitles.length,
        cleanCount: uniqueTitles.length,
        titles: uniqueTitles,
        detectionResults
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

function findMusicTitleColumn(data: any[][]): number {
  if (data.length < 2) return -1;
  
  const pattern = /nome\s+da\s+musica:/i;
  
  // Check each column
  const numColumns = Math.max(...data.map(row => row.length));
  
  for (let colIndex = 0; colIndex < numColumns; colIndex++) {
    let matchCount = 0;
    let totalNonEmpty = 0;
    
    // Check all rows for this column (skip header)
    for (let rowIndex = 1; rowIndex < data.length; rowIndex++) {
      const cellValue = data[rowIndex][colIndex];
      
      if (cellValue && typeof cellValue === 'string' && cellValue.trim()) {
        totalNonEmpty++;
        if (pattern.test(cellValue)) {
          matchCount++;
        }
      }
    }
    
    // If >=50% of non-empty cells match the pattern, this is our column
    if (totalNonEmpty > 0 && (matchCount / totalNonEmpty) >= 0.5) {
      return colIndex;
    }
  }
  
  return -1;
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
