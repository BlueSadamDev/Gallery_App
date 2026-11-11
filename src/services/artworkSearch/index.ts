// Point d'entrée de la recherche d'œuvres pour les écrans de l'app.
// 1. L'IA (si une clé est enregistrée) prépare des pistes : autres titres, artiste probable.
// 2. Wikidata fournit les propositions, vérifiées sur l'artiste et l'année saisis.
// Sans clé, ou si l'IA ne répond pas, la recherche se fait avec la seule saisie.

import { prepareSearch, type SearchHints } from '@/utils/gemini';
import { searchArtworks, type SearchResult } from './wikidata.ts';

export { ArtworkSearchError, type Proposal, type SearchResult } from './wikidata.ts';

export type SearchInput = { title: string; artist?: string; year?: string };

export async function findProposals(
  input: SearchInput,
  excludedIds: string[] = []
): Promise<SearchResult> {
  let hints: SearchHints | null = null;
  try {
    hints = await prepareSearch(input.title, input.artist, input.year);
  } catch {
    hints = null; // l'IA est facultative : on continue sans elle
  }
  const usable = hints && hints.confidence !== 'faible' ? hints : null;
  return searchArtworks(
    {
      title: input.title,
      artist: input.artist,
      year: input.year,
      altTitles: usable ? [usable.frenchTitle, usable.originalTitle, ...usable.altTitles] : [],
      // L'artiste deviné ne sert qu'à classer, jamais à exclure.
      artistHint: usable?.artist,
    },
    excludedIds
  );
}
