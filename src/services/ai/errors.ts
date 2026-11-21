// Classement des réponses d'erreur en catégories, et messages affichés.
// Sources : documentation Google « API errors (generateContent) » et « Troubleshooting »,
// lues le 21/11/2026 (aistudio.google.com/docs/api-errors?generate-content=true).

import { AiError, type AiErrorCategory } from './types.ts';

// Délai d'attente par défaut quand Google signale un quota sans préciser le délai.
export const DEFAULT_RETRY_AFTER_MS = 60_000;

// Messages courts, au vouvoiement, qui disent quoi faire.
export const AI_ERROR_MESSAGES: Record<AiErrorCategory, string> = {
  CLÉ_INVALIDE: 'Votre clé Gemini n’est pas reconnue. Vérifiez-la dans les paramètres.',
  ACCÈS_REFUSÉ:
    'Google refuse l’accès avec cette clé (pays, vérification ou droits du projet). Consultez votre projet dans Google AI Studio.',
  QUOTA_MINUTE: 'Trop de demandes en une minute. Réessayez dans un instant.',
  QUOTA_JOUR: 'Quota IA du jour atteint. Vous pouvez saisir l’œuvre à la main.',
  MODÈLE_INTROUVABLE:
    'Ce modèle n’est pas disponible avec votre clé. Choisissez-en un autre dans les paramètres.',
  SURCHARGE: 'Le service de Google est surchargé. Réessayez dans quelques minutes.',
  DÉLAI_DÉPASSÉ: 'L’IA a mis trop de temps à répondre. Réessayez.',
  HORS_LIGNE: 'Vous êtes hors ligne. Vérifiez votre connexion.',
  CONTENU_BLOQUÉ: 'L’IA n’a pas donné de réponse à cette demande. Vous pouvez saisir l’œuvre à la main.',
  RÉPONSE_INVALIDE: 'La réponse de l’IA est illisible. Réessayez ou saisissez l’œuvre à la main.',
  INCONNUE: 'L’IA n’a pas pu répondre. Réessayez plus tard ou saisissez l’œuvre à la main.',
};

// Message à afficher pour une erreur quelconque (une erreur non classée devient INCONNUE).
export function aiErrorMessage(error: unknown): string {
  if (error instanceof AiError) {
    if (error.category === 'QUOTA_MINUTE' && error.retryAfterMs) {
      const seconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
      return `Trop de demandes en une minute. Réessayez dans ${seconds} s.`;
    }
    return AI_ERROR_MESSAGES[error.category];
  }
  return AI_ERROR_MESSAGES.INCONNUE;
}

// ---------------------------------------------------------------------------
// Lecture du corps d'erreur renvoyé par Google (format gRPC) :
// { error: { code, message, status, details: [ { "@type": "...ErrorInfo", reason }, ... ] } }
// ---------------------------------------------------------------------------

type ErrorDetail = {
  '@type'?: string;
  reason?: string;
  retryDelay?: string;
  violations?: { quotaId?: string; quotaMetric?: string }[];
};

type ErrorBody = {
  error?: { code?: number; message?: string; status?: string; details?: ErrorDetail[] };
};

// Convertit « 37s » ou « 1.5s » en millisecondes.
export function parseRetryDelay(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) return null;
  return Math.round(parseFloat(match[1]) * 1000);
}

// À VÉRIFIER avec une vraie erreur 429 : la documentation ne décrit pas comment
// distinguer la limite par minute de la limite par jour. Google envoie en pratique
// un détail « QuotaFailure » dont le nom de quota contient « PerDay » ou « PerMinute »,
// et un détail « RetryInfo » avec le délai de reprise. Sans indication : minute.
export const QUOTA_DAY_PATTERN = /per\s*day|perday|daily/i;
export const QUOTA_MINUTE_PATTERN = /per\s*minute|perminute/i;
// « limit: 0 » : le modèle n'a aucun quota gratuit pour ce projet (À VÉRIFIER).
export const QUOTA_ZERO_PATTERN = /limit:\s*0\b/i;

function classify429(body: ErrorBody, model: string): AiError {
  const details = body.error?.details ?? [];
  const message = body.error?.message ?? '';
  let retryAfterMs: number | null = null;
  const quotaNames: string[] = [];
  for (const detail of details) {
    const type = detail['@type'] ?? '';
    if (type.endsWith('RetryInfo')) retryAfterMs = parseRetryDelay(detail.retryDelay);
    if (type.endsWith('QuotaFailure')) {
      for (const v of detail.violations ?? []) quotaNames.push(`${v.quotaId ?? ''} ${v.quotaMetric ?? ''}`);
    }
  }
  if (QUOTA_ZERO_PATTERN.test(message)) {
    return new AiError('MODÈLE_INTROUVABLE', model, { httpStatus: 429 });
  }
  const names = quotaNames.join(' ');
  if (QUOTA_DAY_PATTERN.test(names) && !QUOTA_MINUTE_PATTERN.test(names)) {
    return new AiError('QUOTA_JOUR', model, { httpStatus: 429, retryAfterMs });
  }
  return new AiError('QUOTA_MINUTE', model, {
    httpStatus: 429,
    retryAfterMs: retryAfterMs ?? DEFAULT_RETRY_AFTER_MS,
  });
}

const KEY_PROBLEM = /api key not valid|api_key_invalid|api key expired|leaked|invalid api key/i;

// Classe une réponse HTTP en erreur. `body` est le JSON reçu (ou null s'il est illisible).
export function classifyHttpError(status: number, body: unknown, model: string): AiError {
  const parsed = (body && typeof body === 'object' ? body : {}) as ErrorBody;
  const grpcStatus = parsed.error?.status ?? '';
  const reasons = (parsed.error?.details ?? []).map((d) => d.reason ?? '').join(' ');
  const text = `${parsed.error?.message ?? ''} ${reasons}`;
  const options = { httpStatus: status };

  if (status === 429) return classify429(parsed, model);
  if (status === 401 || reasons.includes('API_KEY_INVALID') || KEY_PROBLEM.test(text)) {
    return new AiError('CLÉ_INVALIDE', model, options);
  }
  if (status === 400 && grpcStatus === 'FAILED_PRECONDITION') return new AiError('ACCÈS_REFUSÉ', model, options);
  if (status === 402 || status === 403) return new AiError('ACCÈS_REFUSÉ', model, options);
  if (status === 404) return new AiError('MODÈLE_INTROUVABLE', model, options);
  if (status === 408 || status === 499 || status === 504) return new AiError('DÉLAI_DÉPASSÉ', model, options);
  if (status >= 500) return new AiError('SURCHARGE', model, options);
  return new AiError('INCONNUE', model, options);
}

// Raisons d'arrêt qui signifient « réponse bloquée » (sécurité, droits d'auteur, etc.).
const BLOCKED_FINISH = new Set([
  'SAFETY',
  'RECITATION',
  'LANGUAGE',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'IMAGE_SAFETY',
  'OTHER',
]);

// Lit une réponse réussie (HTTP 200) et renvoie son texte, ou lève une AiError.
export function extractText(body: unknown, model: string): string {
  if (!body || typeof body !== 'object') throw new AiError('RÉPONSE_INVALIDE', model, { httpStatus: 200 });
  const data = body as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  };
  if (data.promptFeedback?.blockReason) throw new AiError('CONTENU_BLOQUÉ', model, { httpStatus: 200 });
  const candidate = data.candidates?.[0];
  if (!candidate) throw new AiError('CONTENU_BLOQUÉ', model, { httpStatus: 200 });
  // Les modèles récents peuvent renvoyer leur réflexion d'abord, la réponse ensuite :
  // on garde la DERNIÈRE partie de texte qui n'est pas une réflexion.
  let text = '';
  for (const part of candidate.content?.parts ?? []) {
    if (part?.text && !part.thought) text = String(part.text);
  }
  if (!text.trim()) {
    throw new AiError('CONTENU_BLOQUÉ', model, { httpStatus: 200 });
  }
  if (candidate.finishReason && BLOCKED_FINISH.has(candidate.finishReason)) {
    throw new AiError('CONTENU_BLOQUÉ', model, { httpStatus: 200 });
  }
  return text;
}
