// Recherche d'œuvres dans Wikidata (base de connaissances libre, sans clé).
// Les images viennent de Wikimedia Commons.
// Ce fichier n'utilise rien de React Native : il peut être testé avec Node.

import {
  artistMatches,
  formatDate,
  normalize,
  parseWikidataTime,
  parseYear,
  yearMatches,
  type WikidataDate,
} from './matching.ts';

// Nom sous lequel l'app se présente aux serveurs Wikimedia (règle d'usage de leur API).
// Le moyen de contact (adresse du dépôt) est exigé : sans lui, la limite tombe
// à 10 requêtes par minute au lieu de 200.
export const USER_AGENT = 'MaGalerie/1.0 (https://github.com/BlueSadamDev/Gallery_App)';

const API = 'https://www.wikidata.org/w/api.php';
const TIMEOUT_MS = 5000; // délai maximal par requête
const MIN_GAP_MS = 1000; // espace minimal entre deux requêtes (limites Wikimedia)
const MAX_RETRY_AFTER_S = 5; // attente maximale acceptée quand le service demande de patienter
const MAX_IDS = 50; // maximum accepté par l'API en un seul appel
const HOMONYM_LIMIT = 5; // au-delà de 5 artistes différents, on demande une précision

// Une proposition d'œuvre montrée à l'utilisateur.
export type Proposal = {
  id: string; // identifiant Wikidata (ex. Q151952)
  title: string;
  artist: string;
  year: string; // texte lisible (« 1889 », « vers 140 av. J.-C. »)
  location: string; // lieu de conservation (collection), si connu
  imageFile: string | null; // nom du fichier sur Wikimedia Commons
  thumbnailUrl: string | null;
  commonsCategory: string | null;
  wikipediaFr: string | null; // titre de l'article Wikipédia français
  wikipediaEn: string | null;
};

export type SearchQuery = {
  title: string; // titre saisi (obligatoire)
  artist?: string; // artiste saisi : filtre strict
  year?: string; // année saisie : filtre à plus ou moins 10 ans
  altTitles?: string[]; // autres titres proposés par l'IA (titre original, etc.)
  artistHint?: string; // artiste deviné par l'IA : sert seulement à classer, jamais à exclure
};

export type SearchResult = {
  proposals: Proposal[]; // toutes les propositions vérifiées, dans l'ordre
  tooManyHomonyms: boolean; // vrai : demander l'artiste ou l'année avant d'afficher
};

// Erreur lisible : hors ligne, service occupé, trop lent ou autre panne.
export type SearchErrorKind = 'offline' | 'busy' | 'timeout' | 'error';
export class ArtworkSearchError extends Error {
  kind: SearchErrorKind;
  constructor(kind: SearchErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

// ---------------------------------------------------------------------------
// Requêtes : une à la fois, espacées, avec un délai maximal.
// ---------------------------------------------------------------------------

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Place une tâche dans la file : les requêtes ne partent jamais en parallèle.
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

// Un appel réseau, avec délai maximal et en-tête d'identification.
async function request(url: string): Promise<Response> {
  const gap = Date.now() - lastRequestAt;
  if (gap < MIN_GAP_MS) await wait(MIN_GAP_MS - gap);
  lastRequestAt = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ArtworkSearchError('timeout', 'Le service met trop de temps à répondre.');
    }
    throw new ArtworkSearchError('offline', 'Pas de connexion à Internet.');
  } finally {
    clearTimeout(timer);
  }
}

// Requête JSON vers Wikimedia, placée dans la file d'attente.
export function fetchJson(url: string): Promise<any> {
  return enqueue(async () => {
    let response = await request(url);
    // Le service demande parfois de patienter : on respecte ce délai, une seule fois.
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after'));
      if (retryAfter > 0 && retryAfter <= MAX_RETRY_AFTER_S) {
        await wait(retryAfter * 1000);
        response = await request(url);
      }
    }
    if (response.status === 429) {
      throw new ArtworkSearchError('busy', 'Le service est occupé. Réessayez dans un instant.');
    }
    if (!response.ok) {
      throw new ArtworkSearchError('error', `Le service ne répond pas (${response.status}).`);
    }
    try {
      return await response.json();
    } catch {
      throw new ArtworkSearchError('error', 'Réponse du service illisible.');
    }
  });
}

function apiUrl(params: Record<string, string>): string {
  const search = new URLSearchParams({ format: 'json', ...params });
  return `${API}?${search.toString()}`;
}

// ---------------------------------------------------------------------------
// Caches pour la durée de la session (évite de reposer la même question).
// ---------------------------------------------------------------------------

const entityCache = new Map<string, any>();
const namesCache = new Map<string, string[]>(); // id → noms (libellés + alias)
const resultCache = new Map<string, SearchResult>();

// ---------------------------------------------------------------------------
// Appels élémentaires
// ---------------------------------------------------------------------------

// Recherche par libellé (classée par pertinence et notoriété).
async function searchLabels(text: string, limit: number): Promise<string[]> {
  const data = await fetchJson(
    apiUrl({
      action: 'wbsearchentities',
      search: text,
      language: 'fr',
      uselang: 'fr',
      type: 'item',
      limit: String(limit),
    })
  );
  return (data?.search ?? []).map((item: any) => String(item.id));
}

// Recherche plein texte limitée aux éléments qui ont un créateur (P170),
// éventuellement un créateur précis.
async function searchWithCreator(text: string, creatorIds: string[]): Promise<string[]> {
  const filter = creatorIds.length
    ? `haswbstatement:${creatorIds.map((id) => `P170=${id}`).join('|')}`
    : 'haswbstatement:P170';
  const data = await fetchJson(
    apiUrl({ action: 'query', list: 'search', srsearch: `${text} ${filter}`, srlimit: '30' })
  );
  return (data?.query?.search ?? []).map((item: any) => String(item.title));
}

// Lit les fiches complètes (déclarations, libellés, liens Wikipédia).
async function getEntities(ids: string[]): Promise<void> {
  const missing = ids.filter((id) => !entityCache.has(id));
  for (let i = 0; i < missing.length; i += MAX_IDS) {
    const chunk = missing.slice(i, i + MAX_IDS);
    const data = await fetchJson(
      apiUrl({
        action: 'wbgetentities',
        ids: chunk.join('|'),
        props: 'labels|claims|sitelinks',
        languages: 'fr|en',
        sitefilter: 'frwiki|enwiki',
      })
    );
    for (const id of chunk) entityCache.set(id, data?.entities?.[id] ?? null);
  }
}

// Lit les noms (libellés et alias) des créateurs et des lieux.
async function getNames(ids: string[]): Promise<void> {
  const missing = ids.filter((id) => !namesCache.has(id));
  for (let i = 0; i < missing.length; i += MAX_IDS) {
    const chunk = missing.slice(i, i + MAX_IDS);
    const data = await fetchJson(
      apiUrl({
        action: 'wbgetentities',
        ids: chunk.join('|'),
        props: 'labels|aliases',
        languages: 'fr|en|de|it|es|nl',
      })
    );
    for (const id of chunk) {
      const entity = data?.entities?.[id];
      const names: string[] = [];
      const fr = entity?.labels?.fr?.value;
      const en = entity?.labels?.en?.value;
      if (fr) names.push(fr);
      if (en && en !== fr) names.push(en);
      for (const label of Object.values<any>(entity?.labels ?? {})) {
        if (!names.includes(label.value)) names.push(label.value);
      }
      for (const list of Object.values<any>(entity?.aliases ?? {})) {
        for (const alias of list) if (!names.includes(alias.value)) names.push(alias.value);
      }
      namesCache.set(id, names);
    }
  }
}

// ---------------------------------------------------------------------------
// Lecture des déclarations d'une fiche
// ---------------------------------------------------------------------------

// Valeurs d'une propriété, en ignorant les valeurs obsolètes et inconnues.
// Les valeurs « préférées » passent en premier.
function claimValues(entity: any, property: string): any[] {
  const claims: any[] = entity?.claims?.[property] ?? [];
  const usable = claims.filter(
    (claim) => claim?.rank !== 'deprecated' && claim?.mainsnak?.datavalue?.value != null
  );
  usable.sort((a, b) => (a.rank === 'preferred' ? -1 : 0) - (b.rank === 'preferred' ? -1 : 0));
  return usable;
}

function itemIds(entity: any, property: string): string[] {
  return claimValues(entity, property)
    .map((claim) => claim.mainsnak.datavalue.value?.id)
    .filter((id): id is string => typeof id === 'string');
}

// Créateurs d'une œuvre.
// - main : créateurs reconnus (P170).
// - attributed : attributions possibles ou contestées (P170 marqué obsolète,
//   « créateur possible » P1779, qualificatif « attribué à » P1773).
//   Exemple : la Vénus de Milo a un créateur « inconnu » et une attribution
//   contestée à Alexandros d'Antioche.
type Creators = { main: string[]; attributed: string[] };

function creators(entity: any): Creators {
  const main = itemIds(entity, 'P170');
  const attributed: string[] = [];
  const push = (id: unknown) => {
    if (typeof id === 'string' && !main.includes(id) && !attributed.includes(id)) attributed.push(id);
  };
  for (const claim of entity?.claims?.P170 ?? []) {
    if (claim?.rank === 'deprecated') push(claim?.mainsnak?.datavalue?.value?.id);
    for (const qualifier of claim?.qualifiers?.P1773 ?? []) push(qualifier?.datavalue?.value?.id);
  }
  for (const id of itemIds(entity, 'P1779')) push(id);
  return { main, attributed };
}

// Vrai si la fiche décrit une œuvre avec un créateur, même inconnu.
function hasCreator(entity: any): boolean {
  return (entity?.claims?.P170?.length ?? 0) > 0 || (entity?.claims?.P1779?.length ?? 0) > 0;
}

// Tous les noms connus des créateurs et attributions d'une œuvre.
function allCreatorNames(entity: any): string[] {
  const { main, attributed } = creators(entity);
  return [...main, ...attributed].flatMap((id) => namesCache.get(id) ?? []);
}

// Texte de l'artiste affiché sur une proposition.
function artistText(entity: any): string {
  const { main, attributed } = creators(entity);
  const mainNames = main.map((id) => firstName(id)).filter(Boolean);
  if (mainNames.length) return mainNames.join(', ');
  const attributedNames = attributed.map((id) => firstName(id)).filter(Boolean);
  if (attributedNames.length) return `${attributedNames.join(', ')} (attribution)`;
  return 'Artiste inconnu';
}

// Lieu de conservation actuel : collection (P195) sans date de fin, sinon emplacement (P276).
function locationId(entity: any): string | null {
  for (const property of ['P195', 'P276']) {
    const current = claimValues(entity, property).filter((claim) => !claim.qualifiers?.P582);
    const id = current[0]?.mainsnak?.datavalue?.value?.id;
    if (id) return id;
  }
  return null;
}

function dates(entity: any): WikidataDate[] {
  return claimValues(entity, 'P571')
    .map((claim) => {
      const value = claim.mainsnak.datavalue.value;
      return parseWikidataTime(String(value.time), Number(value.precision));
    })
    .filter((date): date is WikidataDate => date !== null);
}

function label(entity: any): string {
  return entity?.labels?.fr?.value ?? entity?.labels?.en?.value ?? '';
}

function firstName(id: string | null): string {
  if (!id) return '';
  return namesCache.get(id)?.[0] ?? '';
}

// Adresse d'une image Commons à une largeur donnée.
export function commonsImageUrl(file: string, width: number): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

// ---------------------------------------------------------------------------
// Recherche principale
// ---------------------------------------------------------------------------

function uniqueTitles(query: SearchQuery): string[] {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const text of [query.title, ...(query.altTitles ?? [])]) {
    const key = normalize(text ?? '');
    if (key && !seen.has(key)) {
      seen.add(key);
      titles.push(text.trim());
    }
  }
  return titles.slice(0, 3);
}

async function runSearch(query: SearchQuery): Promise<SearchResult> {
  const titles = uniqueTitles(query);
  if (titles.length === 0) return { proposals: [], tooManyHomonyms: false };
  const typedArtist = query.artist?.trim() ?? '';
  const typedYear = query.year ? parseYear(query.year) : null;

  // 1. Identifiants possibles de l'artiste saisi.
  const artistIds = typedArtist ? (await searchLabels(typedArtist, 5)).slice(0, 4) : [];

  // 2. Œuvres candidates : par libellé (bien classées), puis plein texte avec créateur.
  const ordered: string[] = [];
  const add = (ids: string[]) => {
    for (const id of ids) if (!ordered.includes(id)) ordered.push(id);
  };
  // Avec un artiste connu, la recherche filtrée passe en premier (plus précise).
  if (artistIds.length) add(await searchWithCreator(titles[0], artistIds));
  for (const title of titles) add(await searchLabels(title, MAX_IDS));
  if (!artistIds.length) add(await searchWithCreator(titles[0], []));
  const candidateIds = ordered.slice(0, MAX_IDS);

  // 3. Fiches complètes ; on ne garde que les œuvres qui ont un créateur (même inconnu).
  await getEntities(candidateIds);
  const artworks = candidateIds
    .map((id) => ({ id, entity: entityCache.get(id) }))
    .filter(({ entity }) => entity && hasCreator(entity))
    .filter(({ entity }) => typedYear === null || yearMatches(typedYear, dates(entity)));

  // 4. Noms des créateurs, des attributions et des lieux.
  const nameIds = new Set<string>();
  for (const { entity } of artworks) {
    const { main, attributed } = creators(entity);
    for (const id of [...main, ...attributed]) nameIds.add(id);
    const place = locationId(entity);
    if (place) nameIds.add(place);
  }
  await getNames([...nameIds]);

  // 5. Vérification de l'artiste : un candidat qui ne correspond pas n'est jamais proposé.
  const verified = artworks.filter(
    ({ entity }) => !typedArtist || artistMatches(typedArtist, allCreatorNames(entity))
  );

  // 6. Classement : l'artiste deviné par l'IA remonte, sans rien exclure.
  const hint = query.artistHint?.trim();
  const hinted = (entity: any) => !!hint && artistMatches(hint, allCreatorNames(entity));
  const ranked = [
    ...verified.filter(({ entity }) => hinted(entity)),
    ...verified.filter(({ entity }) => !hinted(entity)),
  ];

  const proposals: Proposal[] = ranked.map(({ id, entity }) => {
    const imageFile = claimValues(entity, 'P18')[0]?.mainsnak?.datavalue?.value ?? null;
    const date = dates(entity)[0] ?? null;
    return {
      id,
      title: label(entity),
      artist: artistText(entity),
      year: formatDate(date),
      location: firstName(locationId(entity)),
      imageFile,
      thumbnailUrl: imageFile ? commonsImageUrl(imageFile, 320) : null,
      commonsCategory: claimValues(entity, 'P373')[0]?.mainsnak?.datavalue?.value ?? null,
      wikipediaFr: entity?.sitelinks?.frwiki?.title ?? null,
      wikipediaEn: entity?.sitelinks?.enwiki?.title ?? null,
    };
  });

  // 7. Trop d'homonymes : beaucoup d'artistes différents et aucun artiste saisi.
  const distinctArtists = new Set(proposals.map((p) => normalize(p.artist)));
  const tooManyHomonyms = !typedArtist && distinctArtists.size > HOMONYM_LIMIT;

  return { proposals, tooManyHomonyms };
}

// Images possibles d'une œuvre : l'image principale (P18), puis les autres
// fichiers de sa catégorie Wikimedia Commons. Renvoie des noms de fichiers.
const imagesCache = new Map<string, string[]>();

export async function listArtworkImages(proposal: Proposal): Promise<string[]> {
  const cached = imagesCache.get(proposal.id);
  if (cached) return cached;
  const files: string[] = proposal.imageFile ? [proposal.imageFile] : [];
  if (proposal.commonsCategory) {
    try {
      const params = new URLSearchParams({
        format: 'json',
        action: 'query',
        list: 'categorymembers',
        cmtitle: `Category:${proposal.commonsCategory}`,
        cmtype: 'file',
        cmlimit: '20',
      });
      const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
      for (const member of data?.query?.categorymembers ?? []) {
        const file = String(member.title ?? '').replace(/^File:/, '');
        if (/\.(jpe?g|png)$/i.test(file) && !files.includes(file)) files.push(file);
      }
    } catch {
      // pas d'images supplémentaires : on garde l'image principale
    }
  }
  imagesCache.set(proposal.id, files);
  return files;
}

// Extrait d'une source (résumé Wikipédia de l'œuvre) avec son lien.
export type SourceExtract = { text: string; url: string };
const extractCache = new Map<string, SourceExtract | null>();

// Résumé Wikipédia de l'œuvre : français en priorité, sinon anglais.
// Renvoie null si l'œuvre n'a pas d'article ou si le service ne répond pas.
export async function fetchSourceExtract(proposal: Proposal): Promise<SourceExtract | null> {
  if (extractCache.has(proposal.id)) return extractCache.get(proposal.id) ?? null;
  const pages: [string, string | null][] = [
    ['fr', proposal.wikipediaFr],
    ['en', proposal.wikipediaEn],
  ];
  let result: SourceExtract | null = null;
  for (const [lang, title] of pages) {
    if (!title || result) continue;
    try {
      const data = await fetchJson(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
      );
      const text = String(data?.extract ?? '').trim();
      const url = String(data?.content_urls?.desktop?.page ?? '');
      if (data?.type === 'standard' && text.length > 40 && url) result = { text, url };
    } catch {
      // on essaie la langue suivante
    }
  }
  extractCache.set(proposal.id, result);
  return result;
}

// Cherche des œuvres et renvoie les propositions vérifiées.
// `excludedIds` : œuvres refusées pendant la session, jamais reproposées.
// Lève une ArtworkSearchError (hors ligne, service occupé…) en cas de problème.
export async function searchArtworks(
  query: SearchQuery,
  excludedIds: string[] = []
): Promise<SearchResult> {
  const key = JSON.stringify([
    normalize(query.title ?? ''),
    normalize(query.artist ?? ''),
    normalize(query.year ?? ''),
    (query.altTitles ?? []).map(normalize),
    normalize(query.artistHint ?? ''),
  ]);
  let result = resultCache.get(key);
  if (!result) {
    result = await runSearch(query);
    resultCache.set(key, result);
  }
  const excluded = new Set(excludedIds);
  return {
    proposals: result.proposals.filter((p) => !excluded.has(p.id)),
    tooManyHomonyms: result.tooManyHomonyms,
  };
}
