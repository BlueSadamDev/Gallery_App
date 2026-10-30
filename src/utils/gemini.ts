import * as FileSystem from 'expo-file-system/legacy';
import { getGeminiApiKey, getGeminiModel } from '@/config/settings';

// Construit l'adresse de l'API pour le modèle Gemini choisi dans les paramètres.
// gemini-1.5-flash a été retiré par Google ; on utilise des modèles actuels.
function getEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// Informations structurées renvoyées par Gemini pour une œuvre.
export type ArtworkInfo = {
  title: string;
  artist: string;
  year: string;
  description: string;
  style: string;
};

// Lit une image locale en base64 (pour l'envoyer à Gemini).
async function readImageAsBase64(uri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

// Envoie une requête au modèle Gemini et renvoie le texte brut de la réponse.
async function sendRequest(
  apiKey: string,
  model: string,
  parts: ({ text: string } | { inline_data: { mime_type: string; data: string } })[],
  config?: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const requestBody: Record<string, unknown> = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      ...(config ?? {}),
    },
  };

  // Timeout de sécurité : si Gemini ne répond pas en 45 s, on interrompt
  // (un modèle trop lent ou non autorisé échoue alors rapidement).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  let response: Response;
  try {
    response = await fetch(`${getEndpoint(model)}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Erreur Gemini (${response.status})`);
  }

  const data = await response.json();
  const partsList = data?.candidates?.[0]?.content?.parts ?? [];

  // Les modèles récents (Gemini 3.x) peuvent renvoyer plusieurs parties :
  // la réflexion interne d'abord, la réponse finale ensuite.
  // On prend la DERNIÈRE partie contenant du texte, c'est la réponse exploitable.
  let text = '';
  for (const part of partsList) {
    if (part?.text) {
      text = String(part.text);
    }
  }
  return text;
}

// Envoie une image à Gemini pour identifier l'œuvre et renvoyer ses infos.
// Si la clé API est absente, renvoie null.
export async function identifyArtwork(
  imageUri: string
): Promise<ArtworkInfo | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  const model = await getGeminiModel();

  const base64 = await readImageAsBase64(imageUri);
  const mimeType = imageUri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  const prompt = `
Tu es un expert en histoire de l'art. Analyse cette image d'une œuvre d'art.
Renvoie UNIQUEMENT un objet JSON au format suivant, sans aucun texte autour :
{
  "title": "Titre de l'œuvre",
  "artist": "Nom de l'artiste",
  "year": "Année de création",
  "style": "Style ou mouvement artistique (ex. Renaissance, Impressionnisme, Art abstrait, Rococo...)",
  "description": "Description courte et élégante de l'œuvre en français (2-3 phrases)"
}
Si tu ne reconnais pas l'œuvre, décris ce que tu vois de façon générale.
Si tu ne connais pas l'année, mets une valeur vide.
`;

  const text = await sendRequest(apiKey, model, [
    { text: prompt },
    {
      inline_data: {
        mime_type: mimeType,
        data: base64,
      },
    },
  ], { temperature: 0, maxOutputTokens: 8192 });

  return parseArtworkInfo(text);
}

// Envoie un titre d'œuvre à Gemini pour retrouver ses informations.
// Si la clé API est absente, renvoie null.
export async function identifyArtworkByTitle(
  artworkTitle: string
): Promise<ArtworkInfo | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    return null;
  }
  const model = await getGeminiModel();

  const prompt = `
Tu es un expert en histoire de l'art. Une personne te donne le titre d'une œuvre d'art : « ${artworkTitle} ».
Retrouve l'œuvre la plus célèbre correspondant à ce titre.
Renvoie UNIQUEMENT un objet JSON au format suivant, sans aucun texte autour :
{
  "title": "Titre exact de l'œuvre",
  "artist": "Nom de l'artiste",
  "year": "Année de création",
  "style": "Style ou mouvement artistique (ex. Renaissance, Impressionnisme, Art abstrait, Rococo...)",
  "description": "Description courte et élégante de l'œuvre en français (2-3 phrases)"
}
Si tu ne connais pas l'année, mets une valeur vide.
Si tu ne trouves aucune œuvre correspondante, renvoie tous les champs vides.
`;

  const text = await sendRequest(apiKey, model, [{ text: prompt }], { temperature: 0, maxOutputTokens: 8192 });

  return parseArtworkInfo(text);
}

// Envoie une requête très simple au modèle choisi pour vérifier qu'il fonctionne.
// Renvoie un message lisible : succès, ou la cause de l'échec.
export async function testGeminiModel(): Promise<string> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    return 'Aucune clé API enregistrée.';
  }
  const model = await getGeminiModel();
  try {
    await sendRequest(apiKey, model, [{ text: 'Réponds uniquement : ok' }], {
      temperature: 0,
      maxOutputTokens: 256,
    });
    return `Modèle ${model} : OK`;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return `Modèle ${model} : échec (${detail})`;
  }
}

// Extrait et analyse le JSON renvoyé par Gemini.
function parseArtworkInfo(raw: string): ArtworkInfo {
  // Enlève les blocs de code markdown éventuels (```json ... ```).
  let cleaned = raw.replace(/```json\s*|```\s*/g, '').trim();

  // Si le texte ne commence pas par {, on cherche le premier { et le dernier }.
  if (!cleaned.startsWith('{')) {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      cleaned = cleaned.substring(start, end + 1);
    }
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      title: String(parsed.title ?? '').trim(),
      artist: String(parsed.artist ?? '').trim(),
      year: String(parsed.year ?? '').trim(),
      description: String(parsed.description ?? '').trim(),
      style: String(parsed.style ?? '').trim(),
    };
  } catch {
    // En cas d'échec d'analyse, on affiche la réponse brute dans les logs
    // pour pouvoir identifier le problème.
    console.warn('Gemini : réponse impossible à analyser :', raw);
    return { title: '', artist: '', year: '', description: '', style: '' };
  }
}
