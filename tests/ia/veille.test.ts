/// <reference types="node" />
// Tests de la veille des modèles (scripts/veille-modeles.mjs), sans appel à Google ni à GitHub.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { knownModels, notYetReported, unknownModels } from '../../scripts/veille-modeles.mjs';

const connus: Set<string> = knownModels(
  readFileSync('src/config/settings.ts', 'utf8'),
  readFileSync('src/services/ai/quotas.ts', 'utf8')
);

test('Modèles connus : ceux du menu et ceux de la table des limites', () => {
  for (const m of [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-4-hydrogen',
    'gemini-2.5-flash-lite',
  ]) {
    assert.ok(connus.has(m), m);
  }
});

test('Seuls les nouveaux modèles Gemini de texte sont signalés', () => {
  const google = [
    { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-4.2-flash', displayName: 'Gemini 4.2 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-embedding-002', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-4-flash-tts', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-4-flash-image', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/imagen-5', supportedGenerationMethods: ['predict'] },
  ];
  assert.deepEqual(unknownModels(google, connus), [{ id: 'gemini-4.2-flash', label: 'Gemini 4.2 Flash' }]);
});

test('Un modèle déjà cité dans la fiche n’est pas signalé deux fois', () => {
  const modeles = [{ id: 'gemini-4.2-flash', label: '' }, { id: 'gemini-4.3-flash', label: '' }];
  const fresh = notYetReported(modeles, ['Relevé :\n- `gemini-4.2-flash`']);
  assert.deepEqual(fresh.map((m: { id: string }) => m.id), ['gemini-4.3-flash']);
});
