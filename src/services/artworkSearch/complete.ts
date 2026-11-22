// « Compléter avec l'IA » (écran Modifier) : décide ce qui est rempli à partir
// d'une œuvre trouvée dans Wikidata, sans jamais écraser ce que vous avez saisi.
// Les champs déjà remplis qui diffèrent de Wikidata sont signalés, pas remplacés.
// Le style n'est pas fourni par Wikidata : il reste à saisir à la main.

import { artistMatches, normalize, parseYear } from './matching.ts';
import { commonsImageUrl, type Proposal } from './wikidata.ts';

export const COMPLETION_IMAGE_WIDTH = 1024; // même largeur qu'à l'ajout d'une œuvre

export type CurrentFields = { artist: string; year: string; hasImage: boolean };

export type Difference = { field: 'artist' | 'year'; label: string; yours: string; found: string };

export type CompletionPlan = {
  artist?: string; // à mettre dans le champ vide
  year?: string;
  imageUrl?: string; // image Wikimedia proposée (aucune image enregistrée)
  differences: Difference[];
};

function sameArtist(a: string, b: string): boolean {
  return normalize(a) === normalize(b) || artistMatches(a, [b]) || artistMatches(b, [a]);
}

function sameYear(a: string, b: string): boolean {
  const ya = parseYear(a);
  const yb = parseYear(b);
  if (ya !== null && yb !== null) return ya === yb;
  return normalize(a) === normalize(b);
}

export function planCompletion(current: CurrentFields, proposal: Proposal): CompletionPlan {
  const plan: CompletionPlan = { differences: [] };
  const artist = current.artist.trim();
  const year = current.year.trim();

  if (proposal.artist) {
    if (!artist) plan.artist = proposal.artist;
    else if (!sameArtist(artist, proposal.artist)) {
      plan.differences.push({ field: 'artist', label: 'Auteur', yours: artist, found: proposal.artist });
    }
  }
  if (proposal.year) {
    if (!year) plan.year = proposal.year;
    else if (!sameYear(year, proposal.year)) {
      plan.differences.push({ field: 'year', label: 'Année', yours: year, found: proposal.year });
    }
  }
  if (!current.hasImage && proposal.imageFile) {
    plan.imageUrl = commonsImageUrl(proposal.imageFile, COMPLETION_IMAGE_WIDTH);
  }
  return plan;
}

// Texte des différences, une ligne par champ.
export function describeDifferences(differences: Difference[]): string {
  return differences.map((d) => `${d.label} : « ${d.yours} » ici, « ${d.found} » selon Wikidata`).join('\n');
}
