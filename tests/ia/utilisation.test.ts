/// <reference types="node" />
// Tests de la section « Utilisation de l'IA » des paramètres et du test de tous les modèles.
// Fournisseur simulé : aucun appel réel, clé fictive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAiProvider, setQuotaTracker } from '../../src/services/ai/index.ts';
import { QuotaTracker, type DailyUsage, type ModelStatus } from '../../src/services/ai/quotas.ts';
import { AiError, type AiProvider } from '../../src/services/ai/types.ts';
import { formatHour, usageCountText, usageStateText } from '../../src/services/ai/usage.ts';
import { testAllGeminiModels } from '../../src/utils/gemini.ts';

const statut = (p: Partial<ModelStatus>): ModelStatus => ({
  model: 'gemini-3.5-flash-lite',
  used: 0,
  perDay: 500,
  state: 'disponible',
  until: null,
  ...p,
});

test('Heures à la française, à l’heure du téléphone', () => {
  assert.equal(formatHour(new Date(2026, 10, 24, 9, 0).getTime()), '9 h');
  assert.equal(formatHour(new Date(2026, 10, 24, 9, 5).getTime()), '9 h 05');
  assert.equal(formatHour(new Date(2026, 10, 24, 17, 30).getTime()), '17 h 30');
});

test('Textes d’état : compte du jour et heure de retour', () => {
  const neuf = new Date(2026, 10, 25, 9, 0).getTime();
  assert.equal(usageCountText(statut({ used: 12 })), '12 / 500 aujourd’hui');
  assert.equal(usageCountText(statut({ used: 3, perDay: null })), '3 aujourd’hui');
  assert.equal(usageStateText(statut({})), 'Disponible');
  assert.equal(usageStateText(statut({ state: 'jour', until: neuf })), 'Quota du jour atteint, de retour à 9 h');
  assert.equal(usageStateText(statut({ state: 'surcharge', until: neuf })), 'Surchargé, de nouveau essayé à 9 h');
  assert.match(usageStateText(statut({ state: 'indisponible', until: neuf })), /Indisponible avec votre clé/);
});

test('Tester tous les modèles : une demande par modèle, sans changement de modèle', async () => {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  const appels: string[] = [];
  const p: AiProvider = {
    id: 'simulé',
    async generate(_cle, request) {
      appels.push(request.model);
      if (request.model === 'gemini-3.1-flash-lite') throw new AiError('MODÈLE_INTROUVABLE', request.model);
      if (request.model === 'gemini-3.6-flash') throw new AiError('QUOTA_JOUR', request.model);
      return 'ok';
    },
  };
  setAiProvider(p);
  let usage: DailyUsage | null = null;
  setQuotaTracker(new QuotaTracker({ load: async () => usage, save: async (u) => void (usage = u) }));

  const lignes = await testAllGeminiModels();
  assert.deepEqual(appels, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash']);
  assert.equal(lignes.length, 4);
  assert.equal(lignes[0], 'Gemini 3.5 Flash-Lite : OK');
  assert.match(lignes[1], /^Gemini 3\.1 Flash-Lite : Ce modèle n’est pas disponible/);
  assert.match(lignes[2], /^Gemini 3\.6 Flash : Quota IA du jour atteint/);
  assert.equal(lignes[3], 'Gemini 3.8 Flash : OK');
  assert.ok(!lignes.join(' ').includes('cle-fictive'));
});
