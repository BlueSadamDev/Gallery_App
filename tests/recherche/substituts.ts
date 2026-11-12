/// <reference types="node" />
// Remplaçant de src/config/settings.ts pour le test sur ordinateur.
// Sur le téléphone, la clé est rangée dans le stockage sécurisé ; ici, elle est lue
// dans la variable d'environnement GEMINI_API_KEY. Elle n'est jamais affichée.

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export async function getGeminiApiKey(): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key ? key : null;
}

export async function getGeminiModel(): Promise<string> {
  const model = process.env.GEMINI_MODEL?.trim();
  return model ? model : DEFAULT_GEMINI_MODEL;
}
