import * as SecureStore from 'expo-secure-store';

// Clé sous laquelle est stockée la clé API Gemini dans le stockage sécurisé.
const GEMINI_API_KEY = 'gemini_api_key';
// Clé sous laquelle est stocké le modèle Gemini choisi par l'utilisateur.
const GEMINI_MODEL_KEY = 'gemini_model';

// Modèle Gemini utilisé par défaut (léger et rapide, adapté au forfait gratuit).
// gemini-2.5-flash est refusé par Google pour les nouveaux utilisateurs (erreur 404).
export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

// Modèles proposés à l'utilisateur dans les paramètres.
export const GEMINI_MODELS = [
  { label: 'Gemini 3.1 Flash-Lite (recommandé)', value: 'gemini-3.1-flash-lite' },
  { label: 'Gemini 3.8 Flash', value: 'gemini-3.8-flash' },
  { label: 'Gemini 4 Argon', value: 'gemini-4-argon' },
] as const;

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

// Enregistre le modèle Gemini choisi par l'utilisateur.
export async function saveGeminiModel(model: string): Promise<void> {
  const trimmed = model.trim();
  if (trimmed.length === 0) {
    await SecureStore.deleteItemAsync(GEMINI_MODEL_KEY);
    return;
  }
  await SecureStore.setItemAsync(GEMINI_MODEL_KEY, trimmed);
}

// Récupère le modèle Gemini choisi (ou le modèle par défaut).
// Un modèle enregistré qui n'est plus dans la liste (retiré par Google) est remplacé
// par le modèle par défaut, sans que l'utilisateur ait à retourner dans les paramètres.
export async function getGeminiModel(): Promise<string> {
  const stored = await SecureStore.getItemAsync(GEMINI_MODEL_KEY);
  const known = GEMINI_MODELS.some((item) => item.value === stored);
  return stored && known ? stored : DEFAULT_GEMINI_MODEL;
}
