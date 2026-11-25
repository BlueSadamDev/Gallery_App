/// <reference types="node" />
// Tests des sources du résumé utilisé pour la description (Wikipédia), réseau simulé.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  artistKeyword,
  extractMatchesArtwork,
  fetchSourceExtract,
  type Proposal,
} from '../../src/services/artworkSearch/wikidata.ts';

const LOUVE: Proposal = {
  id: 'Q-test-louve',
  title: 'The She-Wolf',
  artist: 'Jackson Pollock',
  year: '1943',
  location: 'Museum of Modern Art',
  imageFile: null,
  thumbnailUrl: null,
  commonsCategory: null,
  wikipediaFr: null,
  wikipediaEn: null,
  names: [],
  creatorNames: [],
};

const RESUME_LOUVE =
  'The She-Wolf is a 1943 painting by the American artist Jackson Pollock. It was purchased by the Museum of Modern Art in 1944.';

// Remplace le réseau : chaque adresse reçoit la réponse prévue, les autres une 404.
function reseau(routes: Record<string, unknown>) {
  const appels: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    appels.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200 });
  }) as typeof fetch;
  return appels;
}

const resume = (texte: string, url: string) => ({ type: 'standard', extract: texte, content_urls: { desktop: { page: url } } });

test('Nom de l’artiste : nom de famille, sauf artiste inconnu', () => {
  assert.equal(artistKeyword('Jackson Pollock'), 'pollock');
  assert.equal(artistKeyword('Alexandros d’Antioche (attribution)'), 'antioche');
  assert.equal(artistKeyword('Artiste inconnu'), null);
  assert.equal(artistKeyword(''), null);
});

test('Un résumé trouvé par recherche doit citer l’artiste et le titre', () => {
  assert.equal(extractMatchesArtwork(RESUME_LOUVE, LOUVE), true);
  // Autre œuvre du même artiste : refusée.
  assert.equal(extractMatchesArtwork('Mural is a 1943 painting by Jackson Pollock.', LOUVE), false);
  // Même titre, autre sujet : refusé.
  assert.equal(extractMatchesArtwork('The she-wolf is a female wolf in Roman mythology.', LOUVE), false);
  // Artiste inconnu : jamais de recherche approximative.
  assert.equal(extractMatchesArtwork(RESUME_LOUVE, { ...LOUVE, artist: 'Artiste inconnu' }), false);
});

test('Article relié dans une autre langue (espagnol) utilisé si ni français ni anglais', async () => {
  const appels = reseau({
    'es.wikipedia.org/api/rest_v1/page/summary/La_loba':
      resume('La loba es una pintura de 1943 del artista Jackson Pollock, conservada en el MoMA.', 'https://es.wikipedia.org/wiki/La_loba'),
  });
  const r = await fetchSourceExtract({ ...LOUVE, id: 'Q-test-es', wikipediaOther: [{ lang: 'es', title: 'La loba' }] });
  assert.equal(r?.url, 'https://es.wikipedia.org/wiki/La_loba');
  assert.equal(appels.length, 1);
});

test('Aucun article relié : recherche Wikipédia, seul le bon résumé est retenu', async () => {
  const appels = reseau({
    'fr.wikipedia.org/w/api.php': { query: { search: [] } },
    'en.wikipedia.org/w/api.php': { query: { search: [{ title: 'Capitoline Wolf' }, { title: 'The She-Wolf (Pollock)' }] } },
    'en.wikipedia.org/api/rest_v1/page/summary/Capitoline_Wolf':
      resume('The Capitoline Wolf is a bronze sculpture of a she-wolf suckling the twins Romulus and Remus.', 'https://en.wikipedia.org/wiki/Capitoline_Wolf'),
    'en.wikipedia.org/api/rest_v1/page/summary/The_She-Wolf_(Pollock)':
      resume(RESUME_LOUVE, 'https://en.wikipedia.org/wiki/The_She-Wolf_(Pollock)'),
  });
  const r = await fetchSourceExtract({ ...LOUVE, id: 'Q-test-recherche' });
  assert.equal(r?.url, 'https://en.wikipedia.org/wiki/The_She-Wolf_(Pollock)');
  assert.ok(appels[0].includes('fr.wikipedia.org/w/api.php'));
  assert.ok(decodeURIComponent(appels[0]).includes('The She-Wolf Jackson Pollock'));
});

test('Rien de fiable : pas de résumé (description vide plutôt qu’inventée)', async () => {
  reseau({
    'wikipedia.org/w/api.php': { query: { search: [{ title: 'Capitoline Wolf' }] } },
    'page/summary/Capitoline_Wolf': resume('The Capitoline Wolf is a bronze sculpture of a she-wolf.', 'https://x'),
  });
  assert.equal(await fetchSourceExtract({ ...LOUVE, id: 'Q-test-rien' }), null);
});

test('Sans résumé Wikipédia : phrase construite avec les seuls faits de Wikidata', async () => {
  const { factsDescription } = await import('../../src/services/artworkSearch/wikidata.ts');
  assert.equal(
    factsDescription(LOUVE),
    'Œuvre de Jackson Pollock (1943). Lieu de conservation : Museum of Modern Art.'
  );
  assert.equal(factsDescription({ artist: 'Jackson Pollock', year: '', location: '' }), 'Œuvre de Jackson Pollock.');
  assert.equal(
    factsDescription({ artist: 'Artiste inconnu', year: 'XVIIIe siècle', location: 'église Saint-Jacques de Perpignan' }),
    'Œuvre d’un artiste inconnu (XVIIIe siècle). Lieu de conservation : église Saint-Jacques de Perpignan.'
  );
  assert.equal(factsDescription({ artist: 'Artiste inconnu', year: '1700', location: '' }), '');
});
