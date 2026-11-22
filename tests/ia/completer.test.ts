/// <reference types="node" />
// Tests de « Compléter avec l'IA » : ce qui est rempli, ce qui est signalé.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeDifferences, planCompletion } from '../../src/services/artworkSearch/complete.ts';
import type { Proposal } from '../../src/services/artworkSearch/wikidata.ts';

const NUIT: Proposal = {
  id: 'Q45585',
  title: 'La Nuit étoilée',
  artist: 'Vincent van Gogh',
  year: '1889',
  location: 'Museum of Modern Art',
  imageFile: 'Van Gogh - Starry Night.jpg',
  thumbnailUrl: null,
  commonsCategory: null,
  wikipediaFr: 'La Nuit étoilée',
  wikipediaEn: null,
};

test('Champs vides : auteur, année et image remplis', () => {
  const plan = planCompletion({ artist: '', year: '', hasImage: false }, NUIT);
  assert.equal(plan.artist, 'Vincent van Gogh');
  assert.equal(plan.year, '1889');
  assert.match(plan.imageUrl ?? '', /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\/.+width=1024$/);
  assert.deepEqual(plan.differences, []);
});

test('Ce qui est saisi n’est jamais remplacé ; image gardée si elle existe', () => {
  const plan = planCompletion({ artist: 'Van Gogh', year: '1889', hasImage: true }, NUIT);
  assert.equal(plan.artist, undefined);
  assert.equal(plan.year, undefined);
  assert.equal(plan.imageUrl, undefined);
  assert.deepEqual(plan.differences, []);
});

test('Même valeur écrite autrement : pas de différence', () => {
  const plan = planCompletion({ artist: 'vincent VAN GOGH', year: 'vers 1889', hasImage: true }, NUIT);
  assert.deepEqual(plan.differences, []);
});

test('Auteur ou année différents : signalés, pas remplacés', () => {
  const plan = planCompletion({ artist: 'Paul Gauguin', year: '1890', hasImage: true }, NUIT);
  assert.equal(plan.artist, undefined);
  assert.equal(plan.year, undefined);
  assert.deepEqual(
    plan.differences.map((d) => [d.field, d.yours, d.found]),
    [
      ['artist', 'Paul Gauguin', 'Vincent van Gogh'],
      ['year', '1890', '1889'],
    ]
  );
  assert.equal(
    describeDifferences(plan.differences),
    'Auteur : « Paul Gauguin » ici, « Vincent van Gogh » selon Wikidata\nAnnée : « 1890 » ici, « 1889 » selon Wikidata'
  );
});

test('Wikidata ne connaît pas l’année ni l’image : rien n’est inventé', () => {
  const plan = planCompletion({ artist: '', year: '', hasImage: false }, { ...NUIT, year: '', imageFile: null });
  assert.equal(plan.year, undefined);
  assert.equal(plan.imageUrl, undefined);
  assert.equal(plan.artist, 'Vincent van Gogh');
});
