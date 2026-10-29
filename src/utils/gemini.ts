import * as FileSystem from 'expo-file-system/legacy';
import { getGeminiApiKey } from '@/config/settings';

// Modèle Gemini utilisé pour la reconnaissance d'œuvres d'art.
const GEMINI_MODEL = 'gemini-1.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

// Envoie une image à Gemini pour identifier l'œuvre et renvoyer ses infos.
// Si la clé API est absente, renvoie null.
export async function identifyArtwork(
  imageUri: string
): Promise<ArtworkInfo | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

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

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64,
            },
          },
        ],
      },
    ],
  };

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Erreur Gemini (${response.status})`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  return parseArtworkInfo(text);
}

// Extrait et analyse le JSON renvoyé par Gemini.
function parseArtworkInfo(raw: string): ArtworkInfo {
  // Enlève les blocs de code markdown éventuels (```json ... ```).
  const cleaned = raw.replace(/```json|```/g, '').trim();
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
    // En cas d'échec d'analyse, on renvoie un objet vide.
    return { title: '', artist: '', year: '', description: '', style: '' };
  }
}
