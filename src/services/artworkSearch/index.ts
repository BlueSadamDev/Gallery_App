// Point d'entrée de la recherche d'œuvres pour les écrans de l'app.
// 1. L'IA (si une clé est enregistrée) prépare des pistes : autres titres, artiste probable.
// 2. Wikidata fournit les propositions, vérifiées sur l'artiste et l'année saisis.
// Sans clé, ou si l'IA ne répond pas, la recherche se fait avec la seule saisie.

import { isAiError, type AiError } from '@/services/ai';
import { prepareSearch, writeDescription, type SearchHints } from '@/utils/gemini';
import { isProposable, scoreCandidate } from './confidence.ts';
import {
  factsDescription,
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
// Chaque œuvre trouvée dans Wikidata reçoit un score de confiance calculé par l'app
// (src/services/artworkSearch/confidence.ts). Seules les œuvres dont le titre est confirmé
// (Wikidata ou cartel photographié) et dont le score atteint le seuil sont proposées,
// la plus sûre en tête. Liste vide : aucune œuvre identifiée avec certitude.
// `cartelText` : texte lu sur le cartel, vide si vous ne l'avez pas photographié.
export async function findProposalsFromHints(
  hints: SearchHints,
  excludedIds: string[] = [],
  cartelText = ''
): Promise<SearchResult> {
  const title = hints.frenchTitle || hints.originalTitle;
  const result = await searchArtworks(
    {
      title,
      altTitles: [hints.originalTitle, ...hints.altTitles],
      artistHint: hints.artist,
    },
    excludedIds
  );
  const evidence = {
    titles: [hints.frenchTitle, hints.originalTitle, ...hints.altTitles],
    artist: hints.artist,
    aiLevel: hints.confidence,
    cartelText,
  };
  const scored = result.proposals
    .map((proposal, index) => ({ proposal, index, confidence: scoreCandidate(evidence, proposal) }))
    .filter(({ confidence }) => isProposable(confidence))
    .sort((a, b) => b.confidence.score - a.confidence.score || a.index - b.index);
  return {
    proposals: scored.map(({ proposal, confidence }) => ({ ...proposal, confidence: confidence.score })),
    tooManyHomonyms: false,
  };
}

// Description d'une proposition, rédigée par l'IA à partir des seuls faits trouvés
// (Wikidata + extrait Wikipédia). Sans extrait Wikipédia : phrase construite sans IA
// avec les faits de Wikidata (artiste, année, lieu), ou vide s'ils manquent.
export async function describeProposal(proposal: Proposal, variation = false): Promise<string> {
  const extract = await fetchSourceExtract(proposal);
  if (!extract) return factsDescription(proposal);
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
// aiError : la cause classée (quota, clé, etc.), pour un message précis.
export async function findProposals(
  input: SearchInput,
  excludedIds: string[] = []
): Promise<SearchResult & { aiFailed: boolean; aiError: AiError | null }> {
  let hints: SearchHints | null = null;
  let aiFailed = false;
  let aiError: AiError | null = null;
  try {
    hints = await prepareSearch(input.title, input.artist, input.year);
  } catch (error) {
    hints = null; // l'IA est facultative : on continue sans elle
    aiFailed = true;
    aiError = isAiError(error) ? error : null;
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
  return { ...result, aiFailed, aiError };
}
