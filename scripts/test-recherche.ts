// Test de la recherche d'œuvres sur le vrai Wikidata (sans IA).
// Lancement : node scripts/test-recherche.ts
// Chaque cas du fichier cas-recherche.json affiche le résultat attendu,
// les 5 premières propositions obtenues, puis OK ou ÉCHEC.

import cases from './cas-recherche.json' with { type: 'json' };
import { searchArtworks, type Proposal } from '../src/services/artworkSearch/wikidata.ts';
import { normalize } from '../src/services/artworkSearch/matching.ts';

type Expected = {
  texte: string;
  premierId?: string;
  artistesAbsents?: string[];
  artisteDeTous?: string;
  ordre?: string[];
  homonymes?: boolean;
  lieuxDifferentsMin?: number;
  auMoins?: number;
};

type Case = { nom: string; titre: string; artiste: string; annee: string; attendu: Expected };

const has = (p: Proposal, name: string) => normalize(p.artist).includes(normalize(name));

function check(expected: Expected, proposals: Proposal[], homonyms: boolean): string[] {
  const problems: string[] = [];
  if (proposals.length < (expected.auMoins ?? 1)) problems.push('pas assez de propositions');
  if (expected.premierId && proposals[0]?.id !== expected.premierId) {
    problems.push(`premier = ${proposals[0]?.id ?? 'aucun'} au lieu de ${expected.premierId}`);
  }
  for (const name of expected.artistesAbsents ?? []) {
    if (proposals.some((p) => has(p, name))) problems.push(`${name} est proposé`);
  }
  if (expected.artisteDeTous) {
    const wrong = proposals.filter((p) => !has(p, expected.artisteDeTous!));
    if (wrong.length) problems.push(`autres artistes : ${wrong.map((p) => p.artist).join(', ')}`);
  }
  if (expected.ordre) {
    const positions = expected.ordre.map((name) => proposals.findIndex((p) => has(p, name)));
    positions.forEach((pos, i) => {
      if (pos === -1) problems.push(`${expected.ordre![i]} absent`);
    });
    for (let i = 1; i < positions.length; i++) {
      if (positions[0] !== -1 && positions[i] !== -1 && positions[0] > positions[i]) {
        problems.push(`${expected.ordre[0]} n'est pas avant ${expected.ordre[i]}`);
      }
    }
  }
  if (expected.homonymes !== undefined && expected.homonymes !== homonyms) {
    problems.push(`homonymes = ${homonyms}`);
  }
  if (expected.lieuxDifferentsMin) {
    const places = new Set(proposals.slice(0, 5).map((p) => p.location).filter(Boolean));
    if (places.size < expected.lieuxDifferentsMin) problems.push(`${places.size} lieux différents`);
  }
  return problems;
}

async function main() {
  let passed = 0;
  for (const testCase of cases as Case[]) {
    console.log(`\n=== ${testCase.nom} ===`);
    console.log(`Saisie : « ${testCase.titre} » / ${testCase.artiste || '—'} / ${testCase.annee || '—'}`);
    console.log(`Attendu : ${testCase.attendu.texte}`);
    try {
      const result = await searchArtworks({
        title: testCase.titre,
        artist: testCase.artiste,
        year: testCase.annee,
      });
      console.log(`Obtenu : ${result.proposals.length} proposition(s), homonymes = ${result.tooManyHomonyms}`);
      const shown = testCase.attendu.ordre ? result.proposals.slice(0, 12) : result.proposals.slice(0, 5);
      shown.forEach((p, i) => {
        console.log(
          `  ${i + 1}. ${p.title} — ${p.artist} — ${p.year || '?'} — ${p.location || '?'} — ${p.imageFile ? 'image' : 'sans image'} (${p.id})`
        );
      });
      const problems = check(testCase.attendu, result.proposals, result.tooManyHomonyms);
      if (problems.length === 0) {
        passed++;
        console.log('Résultat : OK');
      } else {
        console.log(`Résultat : ÉCHEC (${problems.join(' ; ')})`);
      }
    } catch (error) {
      console.log(`Résultat : ÉCHEC (erreur : ${error instanceof Error ? error.message : String(error)})`);
    }
    // Pause entre deux cas pour respecter les limites de Wikimedia.
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  console.log(`\nBilan : ${passed}/${cases.length} cas réussis.`);
}

main();
