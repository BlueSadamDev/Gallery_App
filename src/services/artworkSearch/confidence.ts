// Score de confiance d'une proposition tirée d'une photo, calculé par l'app.
// L'avis de l'IA ne compte que pour une petite part : le score repose surtout sur ce que
// l'app vérifie elle-même dans Wikidata (titre et artiste) et sur le cartel photographié.
// Ce fichier n'utilise rien de React Native : il peut être testé avec Node.

import { artistMatches, normalize } from './matching.ts';

// Seuil de proposition : en dessous, la proposition n'est jamais montrée.
// Valeur de la spécification, à ajuster avec le jeu de test.
export const CONFIDENCE_THRESHOLD = 0.7;

// Ressemblance minimale entre un titre de l'IA et un nom de l'œuvre dans Wikidata pour que
// le titre compte comme confirmé. 0,9 revient à exiger les mêmes mots (articles mis à part) :
// « Monolithe de saint Dominique » ne confirme pas « Saint Dominique ».
export const TITLE_MATCH_MIN = 0.9;

// Part de chaque élément dans le score (total : 1).
export const WEIGHTS = { title: 0.55, artist: 0.35, ai: 0.1 } as const;

const AI_LEVEL_SCORE = { haute: 1, moyenne: 0.5, faible: 0 } as const;

// Petits mots ignorés quand on compare des titres.
const TITLE_STOPWORDS = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'et',
  'the', 'a', 'an', 'of', 'and',
  'il', 'lo', 'el', 'los', 'las', 'der', 'die', 'das', 'het', 'een',
]);

function titleTokens(text: string): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter((token) => token.length > 0 && !TITLE_STOPWORDS.has(token))
  );
}

// Ressemblance entre deux titres, de 0 (rien en commun) à 1 (mêmes mots).
export function titleSimilarity(a: string, b: string): number {
  const ta = titleTokens(a);
  const tb = titleTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const token of ta) if (tb.has(token)) common += 1;
  return (2 * common) / (ta.size + tb.size);
}

// Vrai si le texte du cartel contient tous les mots d'un des noms de l'œuvre.
export function cartelConfirms(cartelText: string, names: string[]): boolean {
  const read = titleTokens(cartelText);
  if (read.size === 0) return false;
  return names.some((name) => {
    const tokens = titleTokens(name);
    return tokens.size > 0 && [...tokens].every((token) => read.has(token));
  });
}

// Ce que l'IA a proposé à partir de la photo.
export type PhotoEvidence = {
  titles: string[]; // titres proposés par l'IA (français, original, autres)
  artist: string; // artiste proposé par l'IA, vide s'il n'en donne pas
  aiLevel: keyof typeof AI_LEVEL_SCORE;
  // Texte lu sur le cartel. Il ne sert de confirmation que si vous avez photographié
  // le cartel : une inscription gravée sur l'œuvre nomme souvent son sujet, pas l'œuvre.
  cartelText: string;
};

// Ce que Wikidata dit d'une œuvre candidate.
export type CandidateFacts = {
  names: string[]; // titre et autres noms de l'œuvre
  creatorNames: string[]; // noms connus du ou des créateurs (attributions comprises)
};

export type Confidence = {
  score: number; // de 0 à 1, arrondi à 2 décimales
  titleConfirmed: boolean; // titre retrouvé dans Wikidata ou sur le cartel
  confirmedBy: 'wikidata' | 'cartel' | null;
};

function artistScore(artist: string, creatorNames: string[]): number {
  const wanted = artist.trim();
  if (!wanted || creatorNames.length === 0) return 0.5; // rien à comparer : neutre
  const matches =
    artistMatches(wanted, creatorNames) || creatorNames.some((name) => artistMatches(name, [wanted]));
  return matches ? 1 : 0;
}

export function scoreCandidate(evidence: PhotoEvidence, candidate: CandidateFacts): Confidence {
  let titleScore = 0;
  for (const title of evidence.titles) {
    if (!title.trim()) continue;
    for (const name of candidate.names) titleScore = Math.max(titleScore, titleSimilarity(title, name));
  }
  let confirmedBy: Confidence['confirmedBy'] = titleScore >= TITLE_MATCH_MIN ? 'wikidata' : null;
  if (!confirmedBy && evidence.cartelText.trim() && cartelConfirms(evidence.cartelText, candidate.names)) {
    confirmedBy = 'cartel';
    titleScore = 1;
  }
  const raw =
    WEIGHTS.title * titleScore +
    WEIGHTS.artist * artistScore(evidence.artist, candidate.creatorNames) +
    WEIGHTS.ai * AI_LEVEL_SCORE[evidence.aiLevel];
  return {
    score: Math.round(raw * 100) / 100,
    titleConfirmed: confirmedBy !== null,
    confirmedBy,
  };
}

// Une proposition n'est montrée que si son titre est confirmé et que le score atteint le seuil.
export function isProposable(confidence: Confidence): boolean {
  return confidence.titleConfirmed && confidence.score >= CONFIDENCE_THRESHOLD;
}
