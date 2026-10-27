import * as SecureStore from 'expo-secure-store';

// Clé sous laquelle est stockée la clé API Gemini dans le stockage sécurisé.
const GEMINI_API_KEY = 'gemini_api_key';

// Enregistre la clé API Gemini de manière sécurisée sur le téléphone.
// Cette clé n'est jamais stockée en clair dans le code ni dans la base.
export async function saveGeminiApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    await SecureStore.deleteItemAsync(GEMINI_API_KEY);
    return;
  }
  await SecureStore.setItemAsync(GEMINI_API_KEY, trimmed);
}

// Récupère la clé API Gemini sauvegardée (ou null si absente).
export async function getGeminiApiKey(): Promise<string | null> {
  return await SecureStore.getItemAsync(GEMINI_API_KEY);
}

// Indique si une clé API Gemini est déjà enregistrée.
export async function hasGeminiApiKey(): Promise<boolean> {
  const key = await getGeminiApiKey();
  return key !== null && key.length > 0;
}
