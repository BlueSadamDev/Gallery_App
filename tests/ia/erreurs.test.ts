/// <reference types="node" />
// Tests automatiques de la couche IA, avec des réponses de Google simulées.
// Aucun appel réseau réel, aucune vraie clé.
// Lancement : npm run test:ia

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGeminiProvider } from '../../src/services/ai/gemini.ts';
import { AI_ERROR_MESSAGES, aiErrorMessage } from '../../src/services/ai/errors.ts';
import { AI_ERROR_CATEGORIES, AiError, type AiErrorCategory } from '../../src/services/ai/types.ts';

const FAUSSE_CLE = 'AIzaFAUSSE-cle-de-test-9876';
const MODELE = 'gemini-3.5-flash-lite';

type Appel = { url: string; init?: RequestInit };

// Fabrique un faux « fetch » qui renvoie la réponse donnée et note chaque appel.
function fauxFetch(reponse: () => Promise<Response> | Response) {
  const appels: Appel[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    appels.push({ url, init });
    return reponse();
  };
  return { fetchImpl, appels };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function erreurGoogle(code: number, status: string, message: string, details: unknown[] = []) {
  return { error: { code, status, message, details } };
}

async function categorieDe(reponse: () => Promise<Response> | Response, timeoutMs?: number): Promise<AiError> {
  const { fetchImpl } = fauxFetch(reponse);
  const provider = createGeminiProvider(fetchImpl);
  try {
    await provider.generate(FAUSSE_CLE, {
      model: MODELE,
      parts: [{ kind: 'text', text: 'test' }],
      json: true,
      timeoutMs,
    });
  } catch (error) {
    assert.ok(error instanceof AiError, `erreur non classée : ${String(error)}`);
    return error;
  }
  assert.fail('une erreur était attendue');
}

const REPONSE_OK = {
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"ok":true}' }] } }],
};

// ---------------------------------------------------------------------------
// Une réponse simulée par catégorie
// ---------------------------------------------------------------------------

test('CLÉ_INVALIDE : 400 avec la raison API_KEY_INVALID (exemple de la documentation)', async () => {
  const e = await categorieDe(() =>
    json(
      400,
      erreurGoogle(400, 'INVALID_ARGUMENT', 'API key not valid. Please pass a valid API key.', [
        { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' },
      ])
    )
  );
  assert.equal(e.category, 'CLÉ_INVALIDE');
  assert.equal(e.httpStatus, 400);
});

test('CLÉ_INVALIDE : 403 pour une clé signalée comme divulguée', async () => {
  const e = await categorieDe(() =>
    json(403, erreurGoogle(403, 'PERMISSION_DENIED', 'Your API key was reported as leaked. Please use another API key.'))
  );
  assert.equal(e.category, 'CLÉ_INVALIDE');
});

test('ACCÈS_REFUSÉ : 400 FAILED_PRECONDITION (offre gratuite indisponible dans le pays)', async () => {
  const e = await categorieDe(() =>
    json(400, erreurGoogle(400, 'FAILED_PRECONDITION', 'Gemini API free tier is not available in your country.'))
  );
  assert.equal(e.category, 'ACCÈS_REFUSÉ');
});

test('ACCÈS_REFUSÉ : 403 PERMISSION_DENIED (vérification du projet demandée)', async () => {
  const e = await categorieDe(() =>
    json(
      403,
      erreurGoogle(403, 'PERMISSION_DENIED', 'Your project has been denied access.', [
        { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'FREE_TIER_VERIFICATION_REQUIRED' },
      ])
    )
  );
  assert.equal(e.category, 'ACCÈS_REFUSÉ');
});

test('QUOTA_MINUTE : 429 « par minute » avec délai de reprise de 37 s', async () => {
  const e = await categorieDe(() =>
    json(
      429,
      erreurGoogle(429, 'RESOURCE_EXHAUSTED', 'You exceeded your current quota.', [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [
            {
              quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
              quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
            },
          ],
        },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37s' },
      ])
    )
  );
  assert.equal(e.category, 'QUOTA_MINUTE');
  assert.equal(e.retryAfterMs, 37000);
  assert.equal(aiErrorMessage(e), 'Trop de demandes en une minute. Réessayez dans 37 s.');
});

test('QUOTA_MINUTE : 429 sans détail → attente d’une minute par défaut', async () => {
  const e = await categorieDe(() => json(429, erreurGoogle(429, 'RESOURCE_EXHAUSTED', 'Resource exhausted.')));
  assert.equal(e.category, 'QUOTA_MINUTE');
  assert.equal(e.retryAfterMs, 60000);
});

test('QUOTA_JOUR : 429 « par jour »', async () => {
  const e = await categorieDe(() =>
    json(
      429,
      erreurGoogle(429, 'RESOURCE_EXHAUSTED', 'You exceeded your current quota.', [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }],
        },
        { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '3600s' },
      ])
    )
  );
  assert.equal(e.category, 'QUOTA_JOUR');
});

test('MODÈLE_INTROUVABLE : 404', async () => {
  const e = await categorieDe(() =>
    json(404, erreurGoogle(404, 'NOT_FOUND', 'models/gemini-x is not found for API version v1beta'))
  );
  assert.equal(e.category, 'MODÈLE_INTROUVABLE');
});

test('MODÈLE_INTROUVABLE : 429 « limit: 0 » (modèle sans quota gratuit)', async () => {
  const e = await categorieDe(() =>
    json(
      429,
      erreurGoogle(
        429,
        'RESOURCE_EXHAUSTED',
        'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-4-argon'
      )
    )
  );
  assert.equal(e.category, 'MODÈLE_INTROUVABLE');
});

test('SURCHARGE : 503 et 500', async () => {
  const e503 = await categorieDe(() => json(503, erreurGoogle(503, 'UNAVAILABLE', 'The model is overloaded.')));
  assert.equal(e503.category, 'SURCHARGE');
  const e500 = await categorieDe(() => json(500, erreurGoogle(500, 'INTERNAL', 'Internal error.')));
  assert.equal(e500.category, 'SURCHARGE');
});

test('DÉLAI_DÉPASSÉ : 504 de Google', async () => {
  const e = await categorieDe(() => json(504, erreurGoogle(504, 'DEADLINE_EXCEEDED', 'Deadline exceeded.')));
  assert.equal(e.category, 'DÉLAI_DÉPASSÉ');
});

test('DÉLAI_DÉPASSÉ : aucune réponse avant le délai de l’app', async () => {
  const { fetchImpl } = fauxFetch(() => new Promise<Response>(() => undefined));
  // Faux fetch qui respecte l'annulation, comme le vrai.
  const provider = createGeminiProvider(
    (url, init) =>
      new Promise<Response>((_, reject) => {
        void fetchImpl(url, init);
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('Aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })
  );
  await assert.rejects(
    provider.generate(FAUSSE_CLE, { model: MODELE, parts: [{ kind: 'text', text: 'x' }], timeoutMs: 20 }),
    (e: unknown) => e instanceof AiError && e.category === 'DÉLAI_DÉPASSÉ'
  );
});

test('HORS_LIGNE : le réseau est coupé', async () => {
  const e = await categorieDe(() => Promise.reject(new TypeError('Network request failed')));
  assert.equal(e.category, 'HORS_LIGNE');
});

test('CONTENU_BLOQUÉ : demande bloquée par la sécurité', async () => {
  const e = await categorieDe(() => json(200, { promptFeedback: { blockReason: 'SAFETY' } }));
  assert.equal(e.category, 'CONTENU_BLOQUÉ');
});

test('CONTENU_BLOQUÉ : réponse arrêtée pour sécurité, sans texte', async () => {
  const e = await categorieDe(() => json(200, { candidates: [{ finishReason: 'SAFETY', content: { parts: [] } }] }));
  assert.equal(e.category, 'CONTENU_BLOQUÉ');
});

test('CONTENU_BLOQUÉ : réponse vide', async () => {
  const e = await categorieDe(() => json(200, { candidates: [] }));
  assert.equal(e.category, 'CONTENU_BLOQUÉ');
});

test('RÉPONSE_INVALIDE : corps illisible', async () => {
  const e = await categorieDe(() => new Response('<html>pas du JSON</html>', { status: 200 }));
  assert.equal(e.category, 'RÉPONSE_INVALIDE');
});

test('INCONNUE : code inattendu', async () => {
  const e = await categorieDe(() => json(418, { error: { code: 418, message: 'teapot' } }));
  assert.equal(e.category, 'INCONNUE');
});

// ---------------------------------------------------------------------------
// Succès, sécurité de la clé, format de la demande
// ---------------------------------------------------------------------------

test('Succès : renvoie le texte final, sans la réflexion du modèle', async () => {
  const { fetchImpl } = fauxFetch(() =>
    json(200, {
      candidates: [
        {
          finishReason: 'STOP',
          content: { parts: [{ text: 'je réfléchis', thought: true }, { text: '{"ok":true}' }] },
        },
      ],
    })
  );
  const texte = await createGeminiProvider(fetchImpl).generate(FAUSSE_CLE, {
    model: MODELE,
    parts: [{ kind: 'text', text: 'x' }],
  });
  assert.equal(texte, '{"ok":true}');
});

test('La clé part dans un en-tête, jamais dans l’adresse ; pas de « temperature »', async () => {
  const { fetchImpl, appels } = fauxFetch(() => json(200, REPONSE_OK));
  await createGeminiProvider(fetchImpl).generate(FAUSSE_CLE, {
    model: MODELE,
    parts: [
      { kind: 'text', text: 'x' },
      { kind: 'image', mimeType: 'image/jpeg', base64: 'AAAA' },
    ],
    json: true,
  });
  assert.equal(appels.length, 1);
  const { url, init } = appels[0];
  assert.ok(!url.includes(FAUSSE_CLE), 'la clé ne doit pas être dans l’adresse');
  assert.ok(!url.includes('key='));
  assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], FAUSSE_CLE);
  const corps = JSON.parse(String(init?.body));
  assert.equal(corps.generationConfig.temperature, undefined);
  assert.equal(corps.generationConfig.responseMimeType, 'application/json');
  assert.equal(corps.contents[0].parts[1].inline_data.mime_type, 'image/jpeg');
});

test('Aucune erreur ne contient la clé', async () => {
  const e = await categorieDe(() =>
    json(400, erreurGoogle(400, 'INVALID_ARGUMENT', 'API key not valid.', [{ reason: 'API_KEY_INVALID' }]))
  );
  assert.ok(!e.message.includes(FAUSSE_CLE));
  assert.ok(!JSON.stringify(e).includes(FAUSSE_CLE));
});

test('Chaque catégorie a un message court en français, sans point d’exclamation', () => {
  for (const categorie of AI_ERROR_CATEGORIES) {
    const message = AI_ERROR_MESSAGES[categorie as AiErrorCategory];
    assert.ok(message && message.length > 10, `message manquant pour ${categorie}`);
    assert.ok(!message.includes('!'), `point d’exclamation dans ${categorie}`);
    assert.ok(message.length <= 140, `message trop long pour ${categorie}`);
  }
  assert.equal(aiErrorMessage(new Error('autre')), AI_ERROR_MESSAGES.INCONNUE);
});
