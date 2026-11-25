/// <reference types="node" />
// Tests des fonctions d'IA de l'app (recherche, photo, description) branchées sur
// un fournisseur simulé. Vérifie qu'elles passent toutes par le point d'entrée unique.
// La clé de test est fictive et lue par tests/recherche/substituts.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAiProvider, setQuotaTracker } from '../../src/services/ai/index.ts';
import { QuotaTracker, type DailyUsage } from '../../src/services/ai/quotas.ts';
import { AiError, type AiProvider, type AiRequest } from '../../src/services/ai/types.ts';
import { prepareSearch, suggestFromPhoto, testGeminiModel, writeDescription } from '../../src/utils/gemini.ts';

function fournisseur(reponse: (r: AiRequest) => string | AiError) {
  const demandes: AiRequest[] = [];
  const p: AiProvider = {
    id: 'simulé',
    async generate(_cle, request) {
      demandes.push(request);
      const r = reponse(request);
      if (r instanceof AiError) throw r;
      return r;
    },
  };
  setAiProvider(p);
  // Compteur de quota neuf pour chaque test (aucun reste d'un test précédent).
  let usage: DailyUsage | null = null;
  setQuotaTracker(new QuotaTracker({ load: async () => usage, save: async (u) => void (usage = u) }));
  return demandes;
}

const PISTES = JSON.stringify({
  titreOriginal: 'La Gioconda',
  titreFrancais: 'La Joconde',
  titresAlternatifs: ['Mona Lisa'],
  artiste: 'Léonard de Vinci',
  annee: '1503',
  confiance: 'haute',
});

const FAITS = {
  title: 'La Joconde',
  artist: 'Léonard de Vinci',
  year: '1503',
  location: 'Louvre',
  sourceText: 'Portrait peint par Léonard de Vinci.',
  sourceUrl: 'https://fr.wikipedia.org/wiki/La_Joconde',
};

test('Sans clé enregistrée : aucun appel, résultat vide', async () => {
  delete process.env.GEMINI_API_KEY;
  const demandes = fournisseur(() => PISTES);
  assert.equal(await prepareSearch('Joconde'), null);
  assert.equal(await suggestFromPhoto('AAAA'), null);
  assert.equal(await writeDescription(FAITS), '');
  assert.equal(demandes.length, 0);
});

test('Avec clé : recherche par titre, un seul appel, pistes lues', async () => {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  const demandes = fournisseur(() => PISTES);
  const pistes = await prepareSearch('Joconde');
  assert.equal(pistes?.frenchTitle, 'La Joconde');
  assert.equal(demandes.length, 1);
  assert.equal(demandes[0].json, true);
});

test('Photo : image envoyée, un seul appel ; réponse illisible → RÉPONSE_INVALIDE', async () => {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  const demandes = fournisseur(() => 'pas du json');
  await assert.rejects(
    suggestFromPhoto('AAAA', 'BBBB'),
    (e: unknown) => e instanceof AiError && e.category === 'RÉPONSE_INVALIDE'
  );
  assert.equal(demandes.length, 1);
  assert.equal(demandes[0].parts.filter((p) => p.kind === 'image').length, 2);
});

test('Photo : confiance faible → aucune piste, pas d’erreur', async () => {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  fournisseur(() => JSON.stringify({ titreFrancais: 'X', confiance: 'faible' }));
  const lecture = await suggestFromPhoto('AAAA');
  assert.equal(lecture?.hints, null);
  assert.equal(lecture?.model, 'gemini-3.5-flash-lite');
});

test('Photo (Montserrat) : l’inscription est gardée comme lecture, jamais comme titre', async () => {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  const demandes = fournisseur(() =>
    JSON.stringify({ texteLu: 'DOMINGO DE GUZMAN\n1170   1970', titreFrancais: '', confiance: 'faible' })
  );
  const lecture = await suggestFromPhoto('AAAA');
  assert.equal(lecture?.hints, null);
  assert.equal(lecture?.readText, 'DOMINGO DE GUZMAN 1170 1970');
  const consigne = demandes[0].parts[0].kind === 'text' ? demandes[0].parts[0].text : '';
  assert.match(consigne, /N'invente jamais de titre/);
  assert.match(consigne, /n'est pas un titre/);
});

test('Photo : un titre sans confiance faible donne des pistes à vérifier dans Wikidata', async () => {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  fournisseur(() => PISTES);
  const lecture = await suggestFromPhoto('AAAA');
  assert.equal(lecture?.hints?.frenchTitle, 'La Joconde');
  assert.equal(lecture?.readText, '');
});

test('Une erreur classée remonte telle quelle (ex. quota du jour)', async () => {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  fournisseur((r) => new AiError('QUOTA_JOUR', r.model));
  await assert.rejects(prepareSearch('Joconde'), (e: unknown) => e instanceof AiError && e.category === 'QUOTA_JOUR');
  await assert.rejects(writeDescription(FAITS), (e: unknown) => e instanceof AiError && e.category === 'QUOTA_JOUR');
});

test('Description : « Régénérer » demande une autre formulation', async () => {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  const demandes = fournisseur(() => '{"description":"Un portrait célèbre."}');
  assert.equal(await writeDescription(FAITS, true), 'Un portrait célèbre.');
  const consigne = demandes[0].parts[0].kind === 'text' ? demandes[0].parts[0].text : '';
  assert.match(consigne, /formulation différente/);
});

test('Test de clé : message clair avec la cause et l’action', async () => {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  fournisseur((r) => new AiError('CLÉ_INVALIDE', r.model));
  const message = await testGeminiModel();
  assert.match(message, /échec/);
  assert.match(message, /Vérifiez-la dans les paramètres/);
  assert.ok(!message.includes('cle-fictive'));
});
