// Point d'entrée de la recherche d'œuvres pour les écrans de l'app.
// 1. L'IA (si une clé est enregistrée) prépare des pistes : autres titres, artiste probable.
// 2. Wikidata fournit les propositions, vérifiées sur l'artiste et l'année saisis.
// Sans clé, ou si l'IA ne répond pas, la recherche se fait avec la seule saisie.

import { prepareSearch, writeDescription, type SearchHints } from '@/utils/gemini';
import {
  fetchSourceExtract,
  searchArtworks,
  type Proposal,
  type SearchResult,
} from './wikidata.ts';

export type { SearchHints } from '@/utils/gemini';
export {
  ArtworkSearchError,
  commonsImageUrl,
  fetchSourceExtract,
  listArtworkImages,
  USER_AGENT,
  type Proposal,
  type SearchResult,
} from './wikidata.ts';

export type SearchInput = { title: string; artist?: string; year?: string };

// Propositions à partir des pistes tirées d'une photo (étape 4).
// L'artiste lu ou reconnu par l'IA sert à classer (il remonte en tête) mais
// n'exclut rien : c'est vous qui confirmez dans la liste.
export async function findProposalsFromHints(
  hints: SearchHints,
  excludedIds: string[] = []
): Promise<SearchResult> {
  const title = hints.frenchTitle || hints.originalTitle;
  return searchArtworks(
    {
      title,
      altTitles: [hints.originalTitle, ...hints.altTitles],
      artistHint: hints.artist,
    },
    excludedIds
  );
}

// Description d'une proposition, rédigée par l'IA à partir des seuls faits trouvés
// (Wikidata + extrait Wikipédia). Vide s'il manque des faits ou une clé.
export async function describeProposal(proposal: Proposal, variation = false): Promise<string> {
  const extract = await fetchSourceExtract(proposal);
  if (!extract) return '';
  return writeDescription(
    {
      title: proposal.title,
      artist: proposal.artist,
      year: proposal.year,
      location: proposal.location,
      sourceText: extract.text,
      sourceUrl: extract.url,
    },
    variation
  );
}

// aiFailed : vrai si une clé est enregistrée mais que l'IA n'a pas répondu
// (modèle refusé, service surchargé, délai dépassé). Sans clé, il reste faux.
export async function findProposals(
  input: SearchInput,
  excludedIds: string[] = []
): Promise<SearchResult & { aiFailed: boolean }> {
  let hints: SearchHints | null = null;
  let aiFailed = false;
  try {
    hints = await prepareSearch(input.title, input.artist, input.year);
  } catch {
    hints = null; // l'IA est facultative : on continue sans elle
    aiFailed = true;
  }
  const usable = hints && hints.confidence !== 'faible' ? hints : null;
  const result = await searchArtworks(
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
  return { ...result, aiFailed };
}
