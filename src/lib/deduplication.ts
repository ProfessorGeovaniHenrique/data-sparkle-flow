import { ParsedMusic } from './excelParser';

export interface DeduplicationResult {
  unique: ParsedMusic[];
  duplicatesRemoved: number;
  totalOriginal: number;
  duplicateGroups: Map<string, ParsedMusic[]>; // Para debug/visualização
}

/**
 * Deduplica músicas usando chave composta (titulo + artista, case-insensitive)
 * Seleciona a "melhor" versão de cada grupo (mais campos preenchidos)
 */
export function deduplicateMusicData(data: ParsedMusic[]): DeduplicationResult {
  const musicMap = new Map<string, ParsedMusic[]>();
  
  // Agrupa por chave composta
  data.forEach(music => {
    const key = `${music.titulo.toLowerCase().trim()}|${(music.artista || '').toLowerCase().trim()}`;
    
    if (!musicMap.has(key)) {
      musicMap.set(key, []);
    }
    musicMap.get(key)!.push(music);
  });
  
  // Para cada grupo, seleciona a melhor versão
  const unique: ParsedMusic[] = [];
  
  musicMap.forEach((group, key) => {
    if (group.length === 1) {
      // Sem duplicatas neste grupo
      unique.push(group[0]);
    } else {
      // Duplicatas encontradas: seleciona a melhor
      const best = selectBestVersion(group);
      unique.push(best);
    }
  });
  
  return {
    unique,
    duplicatesRemoved: data.length - unique.length,
    totalOriginal: data.length,
    duplicateGroups: new Map(
      Array.from(musicMap.entries()).filter(([_, group]) => group.length > 1)
    )
  };
}

/**
 * Seleciona a melhor versão de um grupo de duplicatas
 * Critérios (em ordem de prioridade):
 * 1. Mais campos preenchidos (compositor, ano)
 * 2. Campos mais longos (prioriza dados completos)
 * 3. Última ocorrência (assume que scraper corrige dados)
 */
function selectBestVersion(versions: ParsedMusic[]): ParsedMusic {
  return versions.reduce((best, current) => {
    const bestScore = getCompletenessScore(best);
    const currentScore = getCompletenessScore(current);
    
    // Retorna a versão com maior score de completude
    return currentScore > bestScore ? current : best;
  });
}

/**
 * Calcula score de completude de uma música
 * Score = soma dos tamanhos dos campos opcionais
 */
function getCompletenessScore(music: ParsedMusic): number {
  let score = 0;
  
  if (music.compositor) score += music.compositor.length;
  if (music.ano) score += music.ano.length * 2; // Ano tem peso maior
  if (music.artista) score += music.artista.length;
  
  return score;
}
