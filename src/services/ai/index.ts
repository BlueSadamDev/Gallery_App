// Point d'entrée unique de tous les appels à l'IA.
// Les écrans et les autres services n'appellent jamais une API d'IA directement :
// ils passent par callAi(). Aujourd'hui un seul fournisseur : Gemini.

import { getGeminiApiKey, getGeminiModel } from '@/config/settings';
import { createGeminiProvider } from './gemini.ts';
import type { AiPart, AiProvider } from './types.ts';

export { AI_ERROR_MESSAGES, aiErrorMessage } from './errors.ts';
export { AiError, isAiError, type AiErrorCategory, type AiPart } from './types.ts';

let provider: AiProvider = createGeminiProvider();

// Pour les tests automatiques : remplace le fournisseur par une version simulée.
export function setAiProvider(next: AiProvider): void {
  provider = next;
}

export type AiCall = {
  parts: AiPart[];
  json?: boolean;
  maxOutputTokens?: number;
  timeoutMs?: number;
  model?: string; // par défaut : le modèle choisi dans les paramètres
};

export type AiAnswer = { text: string; model: string };

// Envoie une demande au modèle. Renvoie null si aucune clé n'est enregistrée.
// En cas d'échec, lève une AiError (catégorie + message en français via aiErrorMessage).
export async function callAi(call: AiCall): Promise<AiAnswer | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;
  const model = call.model ?? (await getGeminiModel());
  const text = await provider.generate(apiKey, {
    model,
    parts: call.parts,
    json: call.json,
    maxOutputTokens: call.maxOutputTokens,
    timeoutMs: call.timeoutMs,
  });
  return { text, model };
}
