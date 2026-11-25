/// <reference types="node" />
// Parcours photo → Wikidata avec un Wikidata simulé (aucun appel réseau réel).
// Vérifie que seules les œuvres confirmées, au-dessus du seuil, sont proposées.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findProposalsFromHints } from '../../src/services/artworkSearch/index.ts';
import type { SearchHints } from '../../src/utils/gemini.ts';

// Une seule œuvre dans ce faux Wikidata : un tableau de saint Dominique par Claudio Coello.
const OEUVRE = {
  labels: { fr: { value: 'Saint Dominique de Guzmán' }, es: { value: 'Santo Domingo de Guzmán' } },
  aliases: {},
  claims: { P170: [{ rank: 'normal', mainsnak: { datavalue: { value: { id: 'Q10' } } } }] },
  sitelinks: {},
};

globalThis.fetch = (async (input: string | URL | Request) => {
  const url = new URL(String(input));
  const p = url.searchParams;
  let data: unknown = {};
  if (p.get('action') === 'wbsearchentities') data = { search: [{ id: 'Q1' }] };
  else if (p.get('action') === 'query') data = { query: { search: [] } };
  else if (p.get('action') === 'wbgetentities' && p.get('props')?.includes('claims')) data = { entities: { Q1: OEUVRE } };
  else if (p.get('action') === 'wbgetentities') data = { entities: { Q10: { labels: { fr: { value: 'Claudio Coello' } } } } };
  return new Response(JSON.stringify(data), { status: 200 });
}) as typeof fetch;

const pistes = (p: Partial<SearchHints>): SearchHints => ({
  originalTitle: '',
  frenchTitle: '',
  altTitles: [],
  artist: '',
  year: '',
  confidence: 'moyenne',
  ...p,
});

test('Montserrat : le nom inventé par l’IA ne donne aucune proposition', async () => {
  const r = await findProposalsFromHints(pistes({ frenchTitle: 'Monolithe de Saint Dominique de Guzmán' }));
  assert.deepEqual(r.proposals, []);
});

test('Titre et artiste confirmés par Wikidata : proposition avec son score', async () => {
  const r = await findProposalsFromHints(
    pistes({ frenchTitle: 'Saint Dominique de Guzmán', artist: 'Claudio Coello', confidence: 'haute' })
  );
  assert.equal(r.proposals.length, 1);
  assert.equal(r.proposals[0].confidence, 1);
  assert.deepEqual(r.proposals[0].creatorNames, ['Claudio Coello']);
  assert.ok(r.proposals[0].names.includes('Santo Domingo de Guzmán'));
});
