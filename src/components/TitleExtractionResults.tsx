import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, Search, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TitleExtractionResultsProps {
  extractedTitles: Array<{
    titulo: string;
    artista?: string;
    fonte: string;
  }>;
  stats: {
    totalFiles: number;
    totalSheets: number;
    totalTitles: number;
    uniqueTitles: number;
  };
  files: Array<{
    filename: string;
    sheets: Array<{
      sheetName: string;
      detectedColumns: any;
      preview: any[];
      count: number;
    }>;
  }>;
  onSelectionChange?: (selected: string[]) => void;
}

export const TitleExtractionResults = ({ 
  extractedTitles,
  stats,
  files,
  onSelectionChange
}: TitleExtractionResultsProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTitles, setSelectedTitles] = useState<Set<string>>(
    new Set(extractedTitles.map(t => t.titulo))
  );
  const [showPreview, setShowPreview] = useState(false);

  const filteredTitles = extractedTitles.filter(item =>
    item.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.artista && item.artista.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectAll = () => {
    const newSet = new Set(filteredTitles.map(t => t.titulo));
    setSelectedTitles(newSet);
    onSelectionChange?.(Array.from(newSet));
  };

  const handleClearAll = () => {
    setSelectedTitles(new Set());
    onSelectionChange?.([]);
  };

  const handleToggleTitle = (titulo: string) => {
    const newSet = new Set(selectedTitles);
    if (newSet.has(titulo)) {
      newSet.delete(titulo);
    } else {
      newSet.add(titulo);
    }
    setSelectedTitles(newSet);
    onSelectionChange?.(Array.from(newSet));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Extração de Títulos Concluída
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Arquivos</p>
            <p className="text-xl font-bold">{stats.totalFiles}</p>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Planilhas</p>
            <p className="text-xl font-bold">{stats.totalSheets}</p>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Total</p>
            <p className="text-xl font-bold">{stats.totalTitles}</p>
          </div>
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Únicos</p>
            <p className="text-xl font-bold text-success">{stats.uniqueTitles}</p>
          </div>
        </div>
        
        {/* Detection Results */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Colunas Detectadas:</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowPreview(!showPreview)}
              >
                <Eye className="w-4 h-4 mr-1" />
                {showPreview ? 'Ocultar' : 'Ver'} Detalhes
              </Button>
            </div>
            
            {showPreview && (
              <div className="space-y-2">
                {files.map((file, fileIdx) => (
                  <div key={fileIdx} className="bg-muted/30 p-3 rounded-lg text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <span className="font-medium">{file.filename}</span>
                    </div>
                    {file.sheets.map((sheet, sheetIdx) => (
                      <div key={sheetIdx} className="ml-6 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{sheet.sheetName}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {sheet.count} músicas
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground ml-2">
                          {sheet.detectedColumns.musicColumn && (
                            <div>✓ Música: {sheet.detectedColumns.musicColumn.name}</div>
                          )}
                          {sheet.detectedColumns.artistColumn && (
                            <div>✓ Artista: {sheet.detectedColumns.artistColumn.name}</div>
                          )}
                          {sheet.detectedColumns.lyricsColumn && (
                            <div>✓ Letra: {sheet.detectedColumns.lyricsColumn.name}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Title Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar músicas ou artistas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedTitles.size} de {filteredTitles.length} selecionados
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleSelectAll}>
                ✓ Selecionar Todos
              </Button>
              <Button size="sm" variant="outline" onClick={handleClearAll}>
                ✗ Limpar
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[300px] border rounded-lg p-3">
            <div className="space-y-2">
              {filteredTitles.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum título encontrado
                </p>
              ) : (
                filteredTitles.slice(0, 100).map((item, idx) => (
                  <div 
                    key={idx}
                    className="flex items-start gap-3 p-2 hover:bg-muted/50 rounded-lg transition-colors"
                  >
                    <Checkbox
                      checked={selectedTitles.has(item.titulo)}
                      onCheckedChange={() => handleToggleTitle(item.titulo)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.titulo}</p>
                      {item.artista && (
                        <p className="text-sm text-muted-foreground truncate">
                          {item.artista}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">{item.fonte}</p>
                    </div>
                  </div>
                ))
              )}
              {filteredTitles.length > 100 && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  Mostrando primeiros 100 de {filteredTitles.length}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};
