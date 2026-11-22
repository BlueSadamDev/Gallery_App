// Point d'entrée unique de tous les appels à l'IA.
// Les écrans et les autres services n'appellent jamais une API d'IA directement :
// ils passent par callAi(). Aujourd'hui un seul fournisseur : Gemini.

import {
  GEMINI_MODELS,
  getGeminiApiKey,
  getGeminiModel,
  loadAiDailyUsage,
  saveAiDailyUsage,
} from '@/config/settings';
import { createGeminiProvider } from './gemini.ts';
import { QuotaTracker, rotationOrder, runWithRotation } from './quotas.ts';
import type { AiPart, AiProvider } from './types.ts';

export { AI_ERROR_MESSAGES, aiErrorMessage } from './errors.ts';
export { AiError, isAiError, type AiErrorCategory, type AiPart } from './types.ts';

let provider: AiProvider = createGeminiProvider();
let tracker = new QuotaTracker({ load: loadAiDailyUsage, save: saveAiDailyUsage });

// Pour les tests automatiques : remplace le fournisseur par une version simulée.
export function setAiProvider(next: AiProvider): void {
  provider = next;
}

// Pour les tests automatiques : remplace le compteur de quota (horloge simulée).
export function setQuotaTracker(next: QuotaTracker): void {
  tracker = next;
}

export type AiCall = {
  parts: AiPart[];
  json?: boolean;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: string; // un modèle précis, sans changement de modèle
  // Faux : seul le modèle choisi est essayé (test de la clé). Vrai par défaut.
  rotate?: boolean;
};

export type AiAnswer = { text: string; model: string };

// Envoie une demande. Renvoie null si aucune clé n'est enregistrée.
// Si le modèle choisi a atteint son quota (minute ou jour), l'app passe au modèle suivant.
// En cas d'échec, lève une AiError (catégorie + message en français via aiErrorMessage).
export async function callAi(call: AiCall): Promise<AiAnswer | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;
  const chosen = call.model ?? (await getGeminiModel());
  const models =
    call.model || call.rotate === false
      ? [chosen]
      : rotationOrder(
          chosen,
          GEMINI_MODELS.map((m) => m.value)
        );
  const { result, model } = await runWithRotation(tracker, models, (m) =>
    provider.generate(apiKey, {
      model: m,
      parts: call.parts,
      json: call.json,
      maxOutputTokens: call.maxOutputTokens,
      timeoutMs: call.timeoutMs,
    })
  );
  return { text: result, model };
}
