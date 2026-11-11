import { getGeminiApiKey, getGeminiModel } from '@/config/settings';

// Construit l'adresse de l'API pour le modèle Gemini choisi dans les paramètres.
// gemini-1.5-flash a été retiré par Google ; on utilise des modèles actuels.
function getEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// Envoie une requête au modèle Gemini et renvoie le texte brut de la réponse.
async function sendRequest(
  apiKey: string,
  model: string,
  parts: ({ text: string } | { inline_data: { mime_type: string; data: string } })[],
  config?: { temperature?: number; maxOutputTokens?: number },
  timeoutMs = 45000
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

  // Timeout de sécurité : si Gemini ne répond pas à temps (45 s par défaut), on interrompt
  // (un modèle trop lent ou non autorisé échoue alors rapidement).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    // La clé part dans un en-tête, jamais dans l'adresse (qui peut finir dans des journaux).
    response = await fetch(getEndpoint(model), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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

// Pistes de recherche préparées par l'IA. Elles servent uniquement à interroger
// Wikidata : l'IA ne fournit ni image, ni adresse, ni description.
export type SearchHints = {
  originalTitle: string;
  frenchTitle: string;
  altTitles: string[];
  artist: string;
  year: string;
  confidence: 'haute' | 'moyenne' | 'faible';
};

// Retire toute adresse Internet d'un texte renvoyé par l'IA.
function stripUrls(text: unknown): string {
  return String(text ?? '')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '')
    .trim();
}

// Lit le JSON des pistes ; renvoie null si la réponse est inexploitable.
export function parseSearchHints(raw: string): SearchHints | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.substring(start, end + 1));
    const confidence = ['haute', 'moyenne', 'faible'].includes(parsed.confiance)
      ? (parsed.confiance as SearchHints['confidence'])
      : 'faible';
    const altTitles = Array.isArray(parsed.titresAlternatifs)
      ? parsed.titresAlternatifs.map(stripUrls).filter((t: string) => t.length > 0).slice(0, 3)
      : [];
    return {
      originalTitle: stripUrls(parsed.titreOriginal),
      frenchTitle: stripUrls(parsed.titreFrancais),
      altTitles,
      artist: stripUrls(parsed.artiste),
      year: stripUrls(parsed.annee),
      confidence,
    };
  } catch {
    return null;
  }
}

// Consigne commune : format des pistes de recherche.
const HINTS_FORMAT = `
Renvoie UNIQUEMENT un objet JSON, sans texte autour :
{
  "titreOriginal": "titre dans la langue d'origine de l'œuvre",
  "titreFrancais": "titre usuel en français",
  "titresAlternatifs": ["autres titres connus, au plus 3"],
  "artiste": "nom complet de l'artiste",
  "annee": "année ou période de création",
  "confiance": "haute | moyenne | faible"
}
N'inclus aucune adresse Internet, aucune image, aucune description.
Si tu n'es pas sûr, laisse le champ vide et mets "confiance": "faible".`;

// Demande à l'IA de préparer la recherche à partir de la saisie de l'utilisateur.
// Renvoie null si aucune clé n'est enregistrée ou si la réponse est inexploitable.
export async function prepareSearch(
  title: string,
  artist?: string,
  year?: string
): Promise<SearchHints | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;
  const model = await getGeminiModel();
  const prompt = `
Tu aides à rechercher une œuvre d'art dans Wikidata. Voici ce que la personne a saisi :
- titre : « ${title} »
- artiste : « ${artist ?? ''} »
- année : « ${year ?? ''} »
Complète les pistes de recherche (titres possibles, artiste, année). Ne contredis pas l'artiste
ni l'année saisis s'ils sont présents.
${HINTS_FORMAT}`;
  // Délai court : l'IA est facultative, la recherche ne doit pas attendre longtemps.
  const text = await sendRequest(
    apiKey,
    model,
    [{ text: prompt }],
    { temperature: 0, maxOutputTokens: 2048 },
    10000
  );
  return parseSearchHints(text);
}

// Faits vérifiés transmis à l'IA pour rédiger une description.
export type DescriptionFacts = {
  title: string;
  artist: string;
  year: string;
  location: string;
  sourceText: string; // extrait de la source
  sourceUrl: string; // lien de la source
};

// Nettoie la description : sans adresse Internet ni espaces superflus.
// (On ne coupe pas par phrases : « av. J.-C. » contient des points.)
function tidyDescription(text: string): string {
  return stripUrls(text).replace(/\s+/g, ' ').trim();
}

// Rédige 2 à 3 phrases en français UNIQUEMENT à partir des faits fournis.
// Renvoie une chaîne vide si aucune clé n'est enregistrée, si l'extrait de source
// manque, ou si l'IA estime que les faits ne suffisent pas.
export async function writeDescription(
  facts: DescriptionFacts,
  variation = false
): Promise<string> {
  if (!facts.sourceText.trim()) return '';
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return '';
  const model = await getGeminiModel();
  const prompt = `
Rédige une courte description d'œuvre d'art en français, en 2 ou 3 phrases, au ton sobre de musée.
Règle absolue : utilise UNIQUEMENT les faits ci-dessous. N'ajoute rien de ta mémoire :
aucune date, aucun nom, aucun chiffre, aucune anecdote qui ne figure pas dans ces faits.
Si ces faits ne suffisent pas pour écrire 2 phrases exactes, renvoie une description vide.

Faits :
- Titre : ${facts.title}
- Artiste : ${facts.artist}
- Année : ${facts.year}
- Lieu de conservation : ${facts.location}
- Extrait de la source (${facts.sourceUrl}) : « ${facts.sourceText} »

Renvoie UNIQUEMENT un objet JSON : { "description": "..." }
N'inclus aucune adresse Internet.`;
  const text = await sendRequest(
    apiKey,
    model,
    [{ text: prompt }],
    { temperature: variation ? 0.7 : 0.2, maxOutputTokens: 2048 },
    20000
  );
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return '';
  try {
    return tidyDescription(String(JSON.parse(text.substring(start, end + 1)).description ?? ''));
  } catch {
    return '';
  }
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

// Identifie une œuvre à partir de photos déjà préparées (réduites, sans métadonnées).
// `photo` : l'œuvre ; `cartel` : la petite étiquette du musée, facultative.
// Un seul appel, sans relance automatique. Renvoie des pistes de recherche
// (jamais d'image, d'adresse ni de description), ou null si la confiance est faible.
export async function suggestFromPhoto(
  photoBase64: string,
  cartelBase64?: string | null
): Promise<SearchHints | null> {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) return null;
  const model = await getGeminiModel();
  const prompt = `
Tu aides à identifier une œuvre d'art photographiée dans un musée ou une exposition.
La première image est l'œuvre.${
    cartelBase64
      ? ' La seconde image est son cartel (étiquette) : lis-le attentivement, il fait foi pour le titre, l\'artiste et l\'année.'
      : ''
  }
Propose des pistes de recherche. Si tu ne reconnais pas l'œuvre avec certitude et qu'aucun
cartel lisible ne l'indique, mets "confiance": "faible".
${HINTS_FORMAT}`;
  const parts: ({ text: string } | { inline_data: { mime_type: string; data: string } })[] = [
    { text: prompt },
    { inline_data: { mime_type: 'image/jpeg', data: photoBase64 } },
  ];
  if (cartelBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: cartelBase64 } });
  const text = await sendRequest(apiKey, model, parts, { temperature: 0, maxOutputTokens: 2048 }, 30000);
  const hints = parseSearchHints(text);
  if (!hints || hints.confidence === 'faible') return null;
  if (!hints.frenchTitle && !hints.originalTitle) return null;
  return hints;
}
