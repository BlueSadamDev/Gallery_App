// Types communs à tous les fournisseurs d'IA.
// Seul le dossier src/services/ai parle à une API d'IA : les écrans passent par lui.

// Catégories d'erreur, identiques quel que soit le fournisseur.
export type AiErrorCategory =
  | 'CLÉ_INVALIDE'
  | 'ACCÈS_REFUSÉ'
  | 'QUOTA_MINUTE'
  | 'QUOTA_JOUR'
  | 'MODÈLE_INTROUVABLE'
  | 'SURCHARGE'
  | 'DÉLAI_DÉPASSÉ'
  | 'HORS_LIGNE'
  | 'CONTENU_BLOQUÉ'
  | 'RÉPONSE_INVALIDE'
  | 'INCONNUE';

export const AI_ERROR_CATEGORIES: readonly AiErrorCategory[] = [
  'CLÉ_INVALIDE',
  'ACCÈS_REFUSÉ',
  'QUOTA_MINUTE',
  'QUOTA_JOUR',
  'MODÈLE_INTROUVABLE',
  'SURCHARGE',
  'DÉLAI_DÉPASSÉ',
  'HORS_LIGNE',
  'CONTENU_BLOQUÉ',
  'RÉPONSE_INVALIDE',
  'INCONNUE',
];

// Erreur normalisée. Elle ne contient jamais la clé, ni le contenu envoyé.
export class AiError extends Error {
  readonly category: AiErrorCategory;
  readonly model: string;
  // Délai de reprise indiqué par le fournisseur (quota par minute), en millisecondes.
  readonly retryAfterMs: number | null;
  // Code HTTP reçu, s'il y en a un (utile pour le journal, sans donnée sensible).
  readonly httpStatus: number | null;

  constructor(
    category: AiErrorCategory,
    model: string,
    options: { retryAfterMs?: number | null; httpStatus?: number | null } = {}
  ) {
    super(`IA ${model} : ${category}`);
    this.name = 'AiError';
    this.category = category;
    this.model = model;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.httpStatus = options.httpStatus ?? null;
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}

// Morceaux d'une demande : du texte, ou une image JPEG encodée en base64.
export type AiPart = { kind: 'text'; text: string } | { kind: 'image'; mimeType: string; base64: string };

export type AiRequest = {
  model: string;
  parts: AiPart[];
  // Vrai : on demande une réponse au format JSON.
  json?: boolean;
  maxOutputTokens?: number;
  timeoutMs?: number;
};

// Interface que tout fournisseur doit respecter (Gemini aujourd'hui, un autre plus tard).
export interface AiProvider {
  readonly id: string; // ex. « gemini »
  // Envoie la demande et renvoie le texte de la réponse, ou lève une AiError.
  generate(apiKey: string, request: AiRequest): Promise<string>;
}
