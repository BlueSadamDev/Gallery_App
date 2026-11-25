/// <reference types="node" />
// Tests du score de confiance des propositions tirées d'une photo.
// Aucun appel réseau : les fiches Wikidata sont décrites à la main.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIDENCE_THRESHOLD,
  cartelConfirms,
  isProposable,
  scoreCandidate,
  titleSimilarity,
  type PhotoEvidence,
} from '../../src/services/artworkSearch/confidence.ts';

const pistes = (p: Partial<PhotoEvidence>): PhotoEvidence => ({
  titles: [],
  artist: '',
  aiLevel: 'moyenne',
  cartelText: '',
  ...p,
});

test('Seuil de proposition : 0,70', () => {
  assert.equal(CONFIDENCE_THRESHOLD, 0.7);
});

test('Ressemblance des titres : articles, accents et majuscules ignorés', () => {
  assert.equal(titleSimilarity('Les Nymphéas', 'nympheas'), 1);
  assert.equal(titleSimilarity('La Nuit étoilée', 'Nuit etoilee'), 1);
  assert.ok(titleSimilarity('La Nuit étoilée', 'Nuit étoilée sur le Rhône') < 0.9);
  assert.equal(titleSimilarity('', 'Guernica'), 0);
});

test('Montserrat : un titre composé par l’IA n’est jamais confirmé', () => {
  const c = scoreCandidate(
    pistes({ titles: ['Monolithe de Saint Dominique de Guzmán'], aiLevel: 'haute' }),
    { names: ['Saint Dominique de Guzmán', 'Santo Domingo de Guzmán'], creatorNames: ['Claudio Coello'] }
  );
  assert.equal(c.titleConfirmed, false);
  assert.equal(isProposable(c), false);
});

test('Montserrat : l’inscription gravée ne confirme rien sans photo du cartel', () => {
  // L'écran ne transmet le texte lu comme cartel que si le cartel a été photographié.
  const c = scoreCandidate(pistes({ titles: ['Monolithe dominicain'], cartelText: '' }), {
    names: ['Domingo de Guzmán'],
    creatorNames: [],
  });
  assert.equal(isProposable(c), false);
});

test('Œuvre connue, titre et artiste confirmés par Wikidata → proposée', () => {
  const c = scoreCandidate(
    pistes({ titles: ['La Nuit étoilée', 'De sterrennacht'], artist: 'Vincent van Gogh', aiLevel: 'haute' }),
    { names: ['La Nuit étoilée', 'The Starry Night', 'De sterrennacht'], creatorNames: ['Vincent van Gogh'] }
  );
  assert.equal(c.confirmedBy, 'wikidata');
  assert.equal(c.score, 1);
  assert.ok(isProposable(c));
});

test('Même titre mais autre artiste (Le Baiser de Rodin au lieu de Klimt) → écartée', () => {
  const c = scoreCandidate(pistes({ titles: ['Le Baiser'], artist: 'Gustav Klimt', aiLevel: 'haute' }), {
    names: ['Le Baiser', 'The Kiss'],
    creatorNames: ['Auguste Rodin'],
  });
  assert.equal(c.titleConfirmed, true);
  assert.equal(isProposable(c), false);
});

test('Titre confirmé, artiste non donné par l’IA, confiance moyenne → proposée', () => {
  const c = scoreCandidate(pistes({ titles: ['Guernica'] }), { names: ['Guernica'], creatorNames: ['Pablo Picasso'] });
  assert.ok(isProposable(c));
  assert.ok(c.score < 0.9);
});

test('Attribution contestée : l’artiste proposé compte parmi les attributions', () => {
  const c = scoreCandidate(pistes({ titles: ['Vénus de Milo'], artist: 'Alexandros d’Antioche' }), {
    names: ['Vénus de Milo', 'Aphrodite de Milos'],
    creatorNames: ['anonyme', 'Alexandros d’Antioche'],
  });
  assert.ok(isProposable(c));
});

test('Cartel photographié : il confirme le titre même si l’IA l’a mal recopié', () => {
  assert.ok(cartelConfirms('Claude Monet, Impression, soleil levant, 1872', ['Impression, soleil levant']));
  const c = scoreCandidate(
    pistes({ titles: ['Soleil levant'], artist: 'Claude Monet', cartelText: 'Claude Monet Impression, soleil levant 1872' }),
    { names: ['Impression, soleil levant'], creatorNames: ['Claude Monet'] }
  );
  assert.equal(c.confirmedBy, 'cartel');
  assert.ok(isProposable(c));
});
