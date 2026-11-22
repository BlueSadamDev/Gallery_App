/// <reference types="node" />
// Tests de la surveillance du quota et du changement automatique de modèle.
// Horloge et réponses de Google simulées : aucun appel réel, clé fictive.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callAi, setAiProvider, setQuotaTracker } from '../../src/services/ai/index.ts';
import {
  MODEL_LIMITS,
  QuotaTracker,
  pacificDay,
  rotationOrder,
  type DailyUsage,
} from '../../src/services/ai/quotas.ts';
import { AiError, type AiProvider } from '../../src/services/ai/types.ts';
import { testGeminiModel } from '../../src/utils/gemini.ts';

// Samedi 21/11/2026, 12 h à Paris (11 h UTC, 3 h du matin en Californie).
const DEBUT = Date.UTC(2026, 10, 21, 11, 0, 0);

function preparer(reponse: (model: string) => string | AiError, debut = DEBUT) {
  process.env.GEMINI_API_KEY = 'cle-fictive';
  delete process.env.GEMINI_MODEL;
  const horloge = { t: debut };
  const appels: string[] = [];
  let usage: DailyUsage | null = null;
  const stockage = {
    load: async () => usage,
    save: async (u: DailyUsage) => {
      usage = JSON.parse(JSON.stringify(u));
    },
  };
  const p: AiProvider = {
    id: 'simulé',
    async generate(_cle, request) {
      appels.push(request.model);
      const r = reponse(request.model);
      if (r instanceof AiError) throw r;
      return r;
    },
  };
  setAiProvider(p);
  const tracker = new QuotaTracker(stockage, () => horloge.t);
  setQuotaTracker(tracker);
  return { horloge, appels, tracker, lireUsage: () => usage };
}

const demande = () => callAi({ parts: [{ kind: 'text', text: 'bonjour' }] });

test('Limites relevées le 21/11/2026', () => {
  assert.deepEqual(MODEL_LIMITS['gemini-3.5-flash-lite'], { perMinute: 15, perDay: 500 });
  assert.deepEqual(MODEL_LIMITS['gemini-3.1-flash-lite'], { perMinute: 15, perDay: 500 });
  assert.deepEqual(MODEL_LIMITS['gemini-3.6-flash'], { perMinute: 5, perDay: 20 });
  assert.deepEqual(MODEL_LIMITS['gemini-3.8-flash'], { perMinute: 5, perDay: 20 });
  assert.deepEqual(MODEL_LIMITS['gemini-4-hydrogen'], { perMinute: 5, perDay: 20 });
  assert.deepEqual(MODEL_LIMITS['gemini-2.5-flash-lite'], { perMinute: 10, perDay: 20 });
});

test('Jour à l’heure du Pacifique : hiver (UTC−8) et été (UTC−7)', () => {
  // Hiver : minuit en Californie = 8 h UTC.
  assert.equal(pacificDay(Date.UTC(2026, 10, 21, 7, 59)), '2026-11-20');
  assert.equal(pacificDay(Date.UTC(2026, 10, 21, 8, 0)), '2026-11-21');
  // Été : minuit en Californie = 7 h UTC.
  assert.equal(pacificDay(Date.UTC(2026, 6, 14, 6, 59)), '2026-07-13');
  assert.equal(pacificDay(Date.UTC(2026, 6, 14, 7, 0)), '2026-07-14');
  // Changements d'heure 2026 : 8 mars et 1er novembre.
  assert.equal(pacificDay(Date.UTC(2026, 2, 8, 7, 30)), '2026-03-07'); // encore l'hiver
  assert.equal(pacificDay(Date.UTC(2026, 2, 9, 7, 0)), '2026-03-09'); // été
  assert.equal(pacificDay(Date.UTC(2026, 10, 1, 7, 30)), '2026-11-01'); // encore l'été
  assert.equal(pacificDay(Date.UTC(2026, 10, 2, 7, 30)), '2026-11-01'); // hiver
  // Nouvel an : 31 décembre en Californie jusqu'à 8 h UTC.
  assert.equal(pacificDay(Date.UTC(2027, 0, 1, 7, 0)), '2026-12-31');
});

test('Ordre d’essai : modèle choisi puis plus gros quota du jour', () => {
  const liste = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash', 'gemini-3.8-flash'];
  assert.deepEqual(rotationOrder('gemini-3.6-flash', liste), [
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
  ]);
  assert.deepEqual(rotationOrder('gemini-3.5-flash-lite', liste), liste);
});

test('Succès : un seul appel, au modèle choisi, compté pour le jour', async () => {
  const { appels, lireUsage } = preparer(() => 'ok');
  const r = await demande();
  assert.equal(r?.model, 'gemini-3.5-flash-lite');
  assert.deepEqual(appels, ['gemini-3.5-flash-lite']);
  assert.deepEqual(lireUsage(), { day: '2026-11-21', counts: { 'gemini-3.5-flash-lite': 1 } });
});

test('QUOTA_MINUTE de Google → modèle suivant tout de suite', async () => {
  const { appels } = preparer((m) =>
    m === 'gemini-3.5-flash-lite' ? new AiError('QUOTA_MINUTE', m, { retryAfterMs: 30_000 }) : 'ok'
  );
  const r = await demande();
  assert.equal(r?.model, 'gemini-3.1-flash-lite');
  assert.deepEqual(appels, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
  // Pendant les 30 s, le premier modèle n'est plus essayé.
  await demande();
  assert.deepEqual(appels.slice(2), ['gemini-3.1-flash-lite']);
});

test('QUOTA_MINUTE : le modèle choisi revient quand le délai est passé', async () => {
  let bloque = true;
  const { appels, horloge } = preparer((m) =>
    bloque && m === 'gemini-3.5-flash-lite' ? new AiError('QUOTA_MINUTE', m, { retryAfterMs: 30_000 }) : 'ok'
  );
  await demande();
  bloque = false;
  horloge.t += 31_000;
  const r = await demande();
  assert.equal(r?.model, 'gemini-3.5-flash-lite');
  assert.equal(appels.length, 3);
});

test('QUOTA_JOUR de Google → modèle suivant, et mis de côté jusqu’à minuit (Pacifique)', async () => {
  let epuise = true;
  const { appels, horloge, lireUsage } = preparer((m) =>
    epuise && m === 'gemini-3.5-flash-lite' ? new AiError('QUOTA_JOUR', m) : 'ok'
  );
  assert.equal((await demande())?.model, 'gemini-3.1-flash-lite');
  assert.equal(lireUsage()?.counts['gemini-3.5-flash-lite'], 500);
  epuise = false;
  horloge.t += 3 * 3_600_000; // 14 h UTC : toujours le 21 en Californie
  assert.equal((await demande())?.model, 'gemini-3.1-flash-lite');
  horloge.t = Date.UTC(2026, 10, 22, 8, 0); // minuit en Californie
  assert.equal((await demande())?.model, 'gemini-3.5-flash-lite');
  assert.deepEqual(appels, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite']);
});

test('Compteur de l’app : limite par minute atteinte → modèle suivant sans appeler Google', async () => {
  const { appels, horloge } = preparer(() => 'ok');
  for (let i = 0; i < 15; i += 1) await demande();
  assert.equal((await demande())?.model, 'gemini-3.1-flash-lite');
  assert.equal(appels.filter((m) => m === 'gemini-3.5-flash-lite').length, 15);
  horloge.t += 60_000;
  assert.equal((await demande())?.model, 'gemini-3.5-flash-lite');
});

test('Compteur de l’app : limite du jour retrouvée après redémarrage', async () => {
  const { appels, lireUsage } = preparer(() => 'ok');
  // Compteur enregistré : 3.5 déjà à 500 aujourd'hui. Nouveau compteur (= app relancée).
  await demande();
  const usage = lireUsage()!;
  usage.counts['gemini-3.5-flash-lite'] = 500;
  setQuotaTracker(new QuotaTracker({ load: async () => usage, save: async () => {} }, () => DEBUT));
  assert.equal((await demande())?.model, 'gemini-3.1-flash-lite');
  assert.deepEqual(appels, ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']);
});

test('Tous les modèles au quota du jour → QUOTA_JOUR, 4 essais au plus', async () => {
  const { appels } = preparer((m) => new AiError('QUOTA_JOUR', m));
  await assert.rejects(demande(), (e: unknown) => e instanceof AiError && e.category === 'QUOTA_JOUR');
  assert.equal(appels.length, 4);
  // Ensuite, plus aucun appel à Google jusqu'à minuit.
  await assert.rejects(demande(), (e: unknown) => e instanceof AiError && e.category === 'QUOTA_JOUR');
  assert.equal(appels.length, 4);
});

test('Tout épuisé mais un modèle se libère dans la minute → QUOTA_MINUTE avec le plus court délai', async () => {
  const { appels } = preparer((m) =>
    m === 'gemini-3.6-flash' ? new AiError('QUOTA_MINUTE', m, { retryAfterMs: 12_000 }) : new AiError('QUOTA_JOUR', m)
  );
  await assert.rejects(
    demande(),
    (e: unknown) => e instanceof AiError && e.category === 'QUOTA_MINUTE' && e.retryAfterMs === 12_000
  );
  assert.equal(appels.length, 4);
});

test('Une autre erreur (clé invalide) ne fait pas changer de modèle', async () => {
  const { appels } = preparer((m) => new AiError('CLÉ_INVALIDE', m));
  await assert.rejects(demande(), (e: unknown) => e instanceof AiError && e.category === 'CLÉ_INVALIDE');
  assert.deepEqual(appels, ['gemini-3.5-flash-lite']);
});

test('Test de la clé : seul le modèle choisi est essayé', async () => {
  const { appels } = preparer((m) => new AiError('QUOTA_MINUTE', m, { retryAfterMs: 5_000 }));
  const message = await testGeminiModel();
  assert.match(message, /gemini-3\.5-flash-lite : échec/);
  assert.deepEqual(appels, ['gemini-3.5-flash-lite']);
});

test('Le compteur enregistré ne contient que des nombres (ni clé ni contenu)', async () => {
  const { lireUsage } = preparer(() => 'ok');
  await demande();
  const texte = JSON.stringify(lireUsage());
  assert.ok(!texte.includes('cle-fictive'));
  assert.ok(!texte.includes('bonjour'));
});
