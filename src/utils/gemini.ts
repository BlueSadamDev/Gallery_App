// Consignes envoyées à l'IA et lecture de ses réponses.
// Aucun appel réseau ici : tout passe par le point d'entrée unique src/services/ai.
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

// Identifie une œuvre à partir de photos déjà préparées (réduites, sans métadonnées).
// `photo` : l'œuvre ; `cartel` : la petite étiquette du musée, facultative.
// Un seul appel, sans relance automatique. Renvoie des pistes de recherche
// (jamais d'image, d'adresse ni de description), ou null si la confiance est faible
// ou si aucune clé n'est enregistrée. Lève une AiError en cas d'échec.
export async function suggestFromPhoto(
  photoBase64: string,
  cartelBase64?: string | null
): Promise<SearchHints | null> {
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
  const parts: AiPart[] = [
    { kind: 'text', text: prompt },
    { kind: 'image', mimeType: 'image/jpeg', base64: photoBase64 },
  ];
  if (cartelBase64) parts.push({ kind: 'image', mimeType: 'image/jpeg', base64: cartelBase64 });
  const answer = await callAi({ parts, json: true, maxOutputTokens: 2048, timeoutMs: 30000 });
  if (!answer) return null;
  const hints = parseSearchHints(answer.text);
  if (!hints) throw new AiError('RÉPONSE_INVALIDE', answer.model);
  if (hints.confidence === 'faible') return null;
  if (!hints.frenchTitle && !hints.originalTitle) return null;
  return hints;
}
