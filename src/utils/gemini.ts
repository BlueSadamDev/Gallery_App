// Consignes envoyées à l'IA et lecture de ses réponses.
// Aucun appel réseau ici : tout passe par le point d'entrée unique src/services/ai.
import { GEMINI_MODELS } from '@/config/settings';
import { AiError, aiErrorMessage, callAi, type AiPart } from '@/services/ai';

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
// Renvoie null si aucune clé n'est enregistrée. Lève une AiError en cas d'échec
// (dont RÉPONSE_INVALIDE si la réponse n'est pas le JSON attendu).
export async function prepareSearch(
  title: string,
  artist?: string,
  year?: string
): Promise<SearchHints | null> {
  const prompt = `
Tu aides à rechercher une œuvre d'art dans Wikidata. Voici ce que la personne a saisi :
- titre : « ${title} »
- artiste : « ${artist ?? ''} »
- année : « ${year ?? ''} »
Complète les pistes de recherche (titres possibles, artiste, année). Ne contredis pas l'artiste
ni l'année saisis s'ils sont présents.
${HINTS_FORMAT}`;
  // Délai court : l'IA est facultative, la recherche ne doit pas attendre longtemps.
  const answer = await callAi({
    parts: [{ kind: 'text', text: prompt }],
    json: true,
    maxOutputTokens: 2048,
    timeoutMs: 10000,
  });
  if (!answer) return null;
  const hints = parseSearchHints(answer.text);
  if (!hints) throw new AiError('RÉPONSE_INVALIDE', answer.model);
  return hints;
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
// manque, ou si l'IA estime que les faits ne suffisent pas. Lève une AiError en cas d'échec.
// `variation` : demande une autre formulation (« Régénérer »). Les modèles récents
// ignorent le réglage « temperature », la consigne le remplace.
export async function writeDescription(
  facts: DescriptionFacts,
  variation = false
): Promise<string> {
  if (!facts.sourceText.trim()) return '';
  const prompt = `
Rédige une courte description d'œuvre d'art en français, en 2 ou 3 phrases, au ton sobre de musée.
Règle absolue : utilise UNIQUEMENT les faits ci-dessous. N'ajoute rien de ta mémoire :
aucune date, aucun nom, aucun chiffre, aucune anecdote qui ne figure pas dans ces faits.
Si ces faits ne suffisent pas pour écrire 2 phrases exactes, renvoie une description vide.${
    variation ? '\nPropose une formulation différente de la plus évidente.' : ''
  }

Faits :
- Titre : ${facts.title}
- Artiste : ${facts.artist}
- Année : ${facts.year}
- Lieu de conservation : ${facts.location}
- Extrait de la source (${facts.sourceUrl}) : « ${facts.sourceText} »

Renvoie UNIQUEMENT un objet JSON : { "description": "..." }
N'inclus aucune adresse Internet.`;
  const answer = await callAi({
    parts: [{ kind: 'text', text: prompt }],
    json: true,
    maxOutputTokens: 2048,
    timeoutMs: 20000,
  });
  if (!answer) return '';
  const text = answer.text;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new AiError('RÉPONSE_INVALIDE', answer.model);
  try {
    return tidyDescription(String(JSON.parse(text.substring(start, end + 1)).description ?? ''));
  } catch {
    throw new AiError('RÉPONSE_INVALIDE', answer.model);
  }
}

// Envoie une requête très simple au modèle choisi pour vérifier qu'il fonctionne.
// Renvoie un message lisible : succès, ou la cause de l'échec avec l'action à faire.
export async function testGeminiModel(): Promise<string> {
  try {
    const answer = await callAi({
      parts: [{ kind: 'text', text: 'Réponds uniquement : ok' }],
      maxOutputTokens: 256,
      rotate: false, // on teste le modèle choisi, pas un autre
    });
    if (!answer) return 'Aucune clé API enregistrée.';
    return `Modèle ${answer.model} : OK`;
  } catch (error) {
    const model = error instanceof AiError ? error.model : 'choisi';
    return `Modèle ${model} : échec. ${aiErrorMessage(error)}`;
  }
}

// Teste chaque modèle proposé, l'un après l'autre (une demande très courte par modèle).
// Un modèle dont le quota du jour est déjà atteint d'après le compteur n'est pas appelé.
// Renvoie une ligne par modèle : « OK » ou la cause de l'échec avec l'action à faire.
export async function testAllGeminiModels(): Promise<string[]> {
  const lines: string[] = [];
  for (const { label, value } of GEMINI_MODELS) {
    const name = label.replace(' (recommandé)', '');
    try {
      const answer = await callAi({
        parts: [{ kind: 'text', text: 'Réponds uniquement : ok' }],
        maxOutputTokens: 256,
        model: value,
      });
      if (!answer) return ['Aucune clé API enregistrée.'];
      lines.push(`${name} : OK`);
    } catch (error) {
      lines.push(`${name} : ${aiErrorMessage(error)}`);
    }
  }
  return lines;
}

// Longueur maximale gardée du texte lu sur l'image (cartel, plaque, inscription).
const MAX_READ_TEXT = 200;

// Ce que l'IA a tiré d'une photo.
// - hints : pistes de recherche, ou null si l'IA ne reconnaît aucune œuvre existante
//   (confiance faible ou aucun titre). Les titres sont ensuite vérifiés dans Wikidata.
// - readText : texte visible sur les images, recopié tel quel. C'est une lecture, jamais un titre.
// - model : modèle qui a répondu.
export type PhotoReading = { hints: SearchHints | null; readText: string; model: string };

// Lit le texte visible renvoyé par l'IA (sans adresse Internet, sur une seule ligne).
export function parseReadText(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end <= start) return '';
  try {
    const parsed = JSON.parse(raw.substring(start, end + 1));
    return stripUrls(parsed.texteLu).replace(/\s+/g, ' ').trim().slice(0, MAX_READ_TEXT);
  } catch {
    return '';
  }
}

// Consigne propre aux photos : la lecture du texte et la reconnaissance sont séparées,
// et l'IA ne doit jamais composer un titre (cas du monolithe de Montserrat).
const PHOTO_FORMAT = `
Renvoie UNIQUEMENT un objet JSON, sans texte autour :
{
  "texteLu": "texte visible sur les images, recopié tel quel (cartel, plaque, inscription, signature), sinon vide",
  "titreOriginal": "titre dans la langue d'origine de l'œuvre",
  "titreFrancais": "titre usuel en français",
  "titresAlternatifs": ["autres titres connus, au plus 3"],
  "artiste": "nom complet de l'artiste",
  "annee": "année ou période de création",
  "confiance": "haute | moyenne | faible"
}
Règles :
- Remplis les titres seulement si tu reconnais une œuvre existante, connue sous ce titre, ou si un cartel indique son titre.
- N'invente jamais de titre. Ne compose pas un nom à partir d'une inscription, du sujet représenté ou de la forme de l'objet. Dans ce cas, laisse les titres vides et mets "confiance": "faible".
- Une inscription gravée ou peinte sur l'œuvre (nom, dates, dédicace) n'est pas un titre : recopie-la seulement dans "texteLu".
- N'inclus aucune adresse Internet, aucune image, aucune description.`;

// Identifie une œuvre à partir de photos déjà préparées (réduites, sans métadonnées).
// `photo` : l'œuvre ; `cartel` : la petite étiquette du musée, facultative.
// Un seul appel, sans relance automatique. Ne renvoie jamais d'image, d'adresse ni de
// description. Renvoie null seulement si aucune clé n'est enregistrée.
// Lève une AiError en cas d'échec.
export async function suggestFromPhoto(
  photoBase64: string,
  cartelBase64?: string | null
): Promise<PhotoReading | null> {
  const prompt = `
Tu aides à identifier une œuvre d'art photographiée dans un musée, une exposition ou dans la rue.
La première image est l'œuvre.${
    cartelBase64
      ? ' La seconde image est son cartel (étiquette) : lis-le attentivement, il fait foi pour le titre, l\'artiste et l\'année.'
      : ''
  }
Propose des pistes de recherche. Si tu ne reconnais pas l'œuvre avec certitude et qu'aucun
cartel lisible ne l'indique, mets "confiance": "faible".
${PHOTO_FORMAT}`;
  const parts: AiPart[] = [
    { kind: 'text', text: prompt },
    { kind: 'image', mimeType: 'image/jpeg', base64: photoBase64 },
  ];
  if (cartelBase64) parts.push({ kind: 'image', mimeType: 'image/jpeg', base64: cartelBase64 });
  const answer = await callAi({ parts, json: true, maxOutputTokens: 2048, timeoutMs: 30000 });
  if (!answer) return null;
  const hints = parseSearchHints(answer.text);
  if (!hints) throw new AiError('RÉPONSE_INVALIDE', answer.model);
  const readText = parseReadText(answer.text);
  const recognized = hints.confidence !== 'faible' && Boolean(hints.frenchTitle || hints.originalTitle);
  return { hints: recognized ? hints : null, readText, model: answer.model };
}
