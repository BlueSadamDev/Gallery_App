/// <reference types="node" />
// Remplaçant de src/config/settings.ts pour le test sur ordinateur.
// Sur le téléphone, la clé est rangée dans le stockage sécurisé ; ici, elle est lue
// dans la variable d'environnement GEMINI_API_KEY. Elle n'est jamais affichée.

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export async function getGeminiApiKey(): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

export async function getGeminiModel(): Promise<string> {
  const model = process.env.GEMINI_MODEL?.trim();
  return model ? model : DEFAULT_GEMINI_MODEL;
}

// Modèles proposés (copie de src/config/settings.ts, pour le changement de modèle).
export const GEMINI_MODELS = [
  { label: 'Gemini 3.5 Flash-Lite (recommandé)', value: 'gemini-3.5-flash-lite' },
  { label: 'Gemini 3.1 Flash-Lite', value: 'gemini-3.1-flash-lite' },
  { label: 'Gemini 3.6 Flash', value: 'gemini-3.6-flash' },
  { label: 'Gemini 3.8 Flash', value: 'gemini-3.8-flash' },
] as const;

// Compteur du jour gardé en mémoire (sur le téléphone : stockage sécurisé).
type AiDailyUsage = { day: string; counts: Record<string, number> };
let usage: AiDailyUsage | null = null;

export async function loadAiDailyUsage(): Promise<AiDailyUsage | null> {
  return usage;
}

export async function saveAiDailyUsage(next: AiDailyUsage): Promise<void> {
  usage = next;
}
