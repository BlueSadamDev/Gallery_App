/// <reference types="node" />
// Test de la recherche d'œuvre sur le vrai service (IA Gemini + Wikidata), sans l'interface.
// Lancement : npm run test:recherche   (la clé est lue dans la variable GEMINI_API_KEY)
// Passe 1 : à froid (caches vides). Passe 2 : mêmes cas, caches de la passe 1 conservés.
// Résultats détaillés : tests/recherche/resultats.json. La clé n'est jamais écrite.

import { writeFileSync } from 'node:fs';
import cases from './cas.json' with { type: 'json' };
import {
  ArtworkSearchError,
  findProposals,
  type Proposal,
  type SearchResult,
} from '../../src/services/artworkSearch/index.ts';
import { normalize } from '../../src/services/artworkSearch/matching.ts';
import { parseSearchHints } from '../../src/utils/gemini.ts';

// ---------------------------------------------------------------------------
// Types du jeu de test
// ---------------------------------------------------------------------------

type Criteres = { artiste?: string[]; lieu?: string[]; titre?: string[]; annee?: string };
type Regles = {
  top1?: Criteres;
  top1Interdit?: Criteres;
  interditsPartout?: Criteres;
  memeQue?: number;
  top3?: Criteres;
  cleArtiste?: string[];
  cleTitre?: string[];
  tousArtiste?: boolean;
  tousTitre?: boolean;
  minPropositions?: number;
  lieuxDistinctsMin?: number;
  anneeEtLieuMin?: number;
  exemplairesDistincts?: boolean;
  contient?: string[][];
  precisionOuArtistes?: { min: number; dont: string[][] };
  zero?: boolean;
  zeroAccepte?: boolean;
  demandePrecision?: boolean;
  horsLigne?: boolean;
};
type Cas = {
  n: number;
  categorie: string;
  titre: string;
  artiste: string;
  annee: string;
  attendu: string;
  regles: Regles;
};

const LISTE = cases as Cas[];
const PAUSE_MS = 1000; // pause entre deux cas
const MAX_APPELS_IA = 60; // par passe

// ---------------------------------------------------------------------------
// Compteurs : on enveloppe fetch pour compter les appels, lire les tokens
// renvoyés par Gemini et simuler la coupure réseau.
// ---------------------------------------------------------------------------

type Compteurs = {
  wikimedia: number;
  gemini: number;
  autres: number;
  tokensEntree: number;
  tokensSortie: number;
  tokensReflexion: number;
  tokensTotal: number;
  statutsGemini: (number | string)[];
  pistesIA: unknown[];
};

const nouveauxCompteurs = (): Compteurs => ({
  wikimedia: 0,
  gemini: 0,
  autres: 0,
  tokensEntree: 0,
  tokensSortie: 0,
  tokensReflexion: 0,
  tokensTotal: 0,
  statutsGemini: [],
  pistesIA: [],
});

let compteurs = nouveauxCompteurs();
let reseauCoupe = false;
let appelsIAPasse = 0;
let appelsIABloques = 0;

const vraiFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const host = new URL(url).hostname;
  const estGemini = host.includes('generativelanguage');
  if (estGemini) compteurs.gemini++;
  else if (/(wikidata|wikimedia|wikipedia)\.org$/.test(host)) compteurs.wikimedia++;
  else compteurs.autres++;

  if (reseauCoupe) throw new TypeError('fetch failed (coupure réseau simulée)');

  if (estGemini) {
    if (appelsIAPasse >= MAX_APPELS_IA) {
      appelsIABloques++;
      compteurs.statutsGemini.push('bloqué (limite 60)');
      throw new Error('Limite de 60 appels IA atteinte pour cette passe');
    }
    appelsIAPasse++;
  }

  let response: Response;
  try {
    response = await vraiFetch(input, init);
  } catch (error) {
    if (estGemini) compteurs.statutsGemini.push('délai dépassé ou échec réseau');
    throw error;
  }

  if (estGemini) {
    compteurs.statutsGemini.push(response.status);
    try {
      const data = await response.clone().json();
      const usage = data?.usageMetadata ?? {};
      compteurs.tokensEntree += Number(usage.promptTokenCount ?? 0);
      compteurs.tokensSortie += Number(usage.candidatesTokenCount ?? 0);
      compteurs.tokensReflexion += Number(usage.thoughtsTokenCount ?? 0);
      compteurs.tokensTotal += Number(usage.totalTokenCount ?? 0);
      let texte = '';
      for (const part of data?.candidates?.[0]?.content?.parts ?? []) {
        if (part?.text) texte = String(part.text);
      }
      compteurs.pistesIA.push(parseSearchHints(texte));
    } catch {
      compteurs.pistesIA.push(null);
    }
  }
  return response;
}) as typeof fetch;

// ---------------------------------------------------------------------------
// Outils de vérification
// ---------------------------------------------------------------------------

const contient = (texte: string, cles: string[] = []) =>
  cles.some((cle) => normalize(texte).includes(normalize(cle)));

function respecte(p: Proposal, c: Criteres): boolean {
  if (c.artiste && !contient(p.artist, c.artiste)) return false;
  if (c.lieu && !contient(p.location, c.lieu)) return false;
  if (c.titre && !contient(p.title, c.titre)) return false;
  if (c.annee && !p.year.includes(c.annee)) return false;
  return true;
}

function interdit(p: Proposal, c?: Criteres): boolean {
  if (!c) return false;
  return (
    (!!c.artiste && contient(p.artist, c.artiste)) ||
    (!!c.titre && contient(p.title, c.titre)) ||
    (!!c.lieu && contient(p.location, c.lieu))
  );
}

// Règles effectives : « Même résultat que le cas N » reprend les règles du cas N.
function reglesDe(cas: Cas): Regles {
  if (cas.regles.memeQue === undefined) return cas.regles;
  const ref = LISTE.find((c) => c.n === cas.regles.memeQue);
  return { ...(ref?.regles ?? {}), ...cas.regles };
}

// Ce que l'écran ferait du résultat (même logique que src/app/add.tsx).
type Decision = 'liste' | 'aucune' | 'precision' | 'erreur';
function decisionEcran(cas: Cas, result: SearchResult | null): Decision {
  if (!result) return 'erreur';
  if (result.proposals.length === 0) return 'aucune';
  if (result.tooManyHomonyms && !cas.artiste.trim() && !cas.annee.trim()) return 'precision';
  return 'liste';
}

// Message que l'écran afficherait en cas d'erreur (copie des textes de src/app/add.tsx).
function messageEcran(kind: string): string {
  if (kind === 'offline') return 'Vous êtes hors ligne. Vous pouvez saisir l’œuvre à la main.';
  if (kind === 'busy') return 'Le service de recherche est occupé. Réessayez dans un instant ou saisissez l’œuvre à la main.';
  if (kind === 'timeout') return 'Le service de recherche ne répond pas. Réessayez ou saisissez l’œuvre à la main.';
  return 'La recherche n’a pas abouti. Réessayez ou saisissez l’œuvre à la main.';
}

type Erreur = { type: string; message: string; plantage: boolean };

function verdict(
  cas: Cas,
  props: Proposal[],
  decision: Decision,
  erreur: Erreur | null
): { ok: boolean; raisons: string[] } {
  const r = reglesDe(cas);
  const raisons: string[] = [];
  const top1 = props[0];

  if (r.horsLigne) {
    if (!erreur) raisons.push(`aucune erreur signalée malgré la coupure (${props.length} propositions)`);
    else if (erreur.plantage) raisons.push(`plantage : ${erreur.message}`);
    else if (erreur.type !== 'offline') raisons.push(`erreur « ${erreur.type} » au lieu de « hors ligne »`);
    return { ok: raisons.length === 0, raisons };
  }
  if (erreur) return { ok: false, raisons: [`erreur ${erreur.type} : ${erreur.message}`] };

  if (r.zero) {
    if (props.length > 0) raisons.push(`${props.length} proposition(s) au lieu de zéro`);
    return { ok: raisons.length === 0, raisons };
  }
  if (r.demandePrecision) {
    if (decision !== 'precision') raisons.push(`l'écran afficherait « ${decision} » (${props.length} propositions) sans demander l'artiste ou l'année`);
    return { ok: raisons.length === 0, raisons };
  }
  if (r.precisionOuArtistes) {
    if (decision === 'precision') return { ok: true, raisons };
    const artistes = new Set(props.map((p) => normalize(p.artist)));
    if (artistes.size < r.precisionOuArtistes.min) raisons.push(`${artistes.size} artiste(s) distinct(s)`);
    for (const groupe of r.precisionOuArtistes.dont) {
      if (!props.some((p) => contient(p.artist, groupe))) raisons.push(`${groupe[0]} absent`);
    }
    return { ok: raisons.length === 0, raisons };
  }
  if (r.zeroAccepte && props.length === 0) return { ok: true, raisons };

  if (r.top1) {
    if (!top1) raisons.push('aucune proposition');
    else if (!respecte(top1, r.top1)) raisons.push(`top-1 ne correspond pas : ${top1.title} / ${top1.artist} / ${top1.year || '?'} / ${top1.location || '?'}`);
  }
  if (top1 && interdit(top1, r.top1Interdit)) raisons.push(`top-1 interdit : ${top1.title} / ${top1.artist}`);
  for (const p of props) {
    if (interdit(p, r.interditsPartout)) raisons.push(`proposition interdite : ${p.title} / ${p.artist}`);
  }
  if (r.top3 && !props.slice(0, 3).some((p) => respecte(p, r.top3!))) raisons.push('absent des 3 premiers');
  if (r.minPropositions && props.length < r.minPropositions) raisons.push(`${props.length} proposition(s), ${r.minPropositions} attendues`);
  if (r.lieuxDistinctsMin) {
    const lieux = new Set(props.map((p) => normalize(p.location)).filter(Boolean));
    if (lieux.size < r.lieuxDistinctsMin) raisons.push(`${lieux.size} lieu(x) différent(s)`);
  }
  if (r.anneeEtLieuMin) {
    const completes = props.filter((p) => p.year && p.location && contient(p.title, r.cleTitre));
    if (completes.length < r.anneeEtLieuMin) raisons.push(`${completes.length} version(s) avec année et lieu`);
  }
  if (r.tousArtiste) {
    const autres = props.filter((p) => !contient(p.artist, r.cleArtiste));
    if (autres.length) raisons.push(`autres artistes : ${autres.map((p) => p.artist).join(', ')}`);
  }
  if (r.tousTitre) {
    const autres = props.filter((p) => !contient(p.title, r.cleTitre));
    if (autres.length) raisons.push(`autres œuvres : ${autres.map((p) => p.title).join(', ')}`);
  }
  if (r.exemplairesDistincts) {
    const exemplaires = props.filter((p) => contient(p.title, r.cleTitre));
    const sansLieu = exemplaires.filter((p) => !p.location).length;
    const cles = exemplaires.map((p) => normalize(`${p.title}|${p.location}`));
    if (sansLieu) raisons.push(`${sansLieu} exemplaire(s) sans lieu`);
    if (new Set(cles).size < cles.length) raisons.push('exemplaires impossibles à distinguer (même titre et même lieu)');
  }
  if (r.contient) {
    const pris = new Set<string>();
    for (const groupe of r.contient) {
      const trouve = props.find((p) => !pris.has(p.id) && contient(p.artist, groupe) && contient(p.title, r.cleTitre));
      if (trouve) pris.add(trouve.id);
      else raisons.push(`${groupe[0]} absent`);
    }
  }
  return { ok: raisons.length === 0, raisons };
}

// Top-3 pour les cas à réponse unique : une des 3 premières respecte le critère du top-1.
function dansTop3(cas: Cas, props: Proposal[]): boolean | null {
  const r = reglesDe(cas);
  if (!r.top1) return null;
  return props.slice(0, 3).some((p) => respecte(p, r.top1!) && !interdit(p, r.top1Interdit));
}

// Faux positifs (artiste saisi) : autre artiste, ou autre œuvre du même artiste.
function fauxPositifs(cas: Cas, props: Proposal[]) {
  const r = reglesDe(cas);
  if (!cas.artiste.trim() || r.horsLigne) return { autreArtiste: [] as string[], autreOeuvre: [] as string[] };
  const autreArtiste = props
    .filter((p) => r.cleArtiste && !contient(p.artist, r.cleArtiste))
    .map((p) => `${p.title} — ${p.artist}`);
  const autreOeuvre = props
    .filter((p) => (!r.cleArtiste || contient(p.artist, r.cleArtiste)) && r.cleTitre && !contient(p.title, r.cleTitre))
    .map((p) => `${p.title} — ${p.artist}`);
  return { autreArtiste, autreOeuvre };
}

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

const attendre = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function quantile(valeurs: number[], q: number): number {
  if (!valeurs.length) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  if (q === 0.5) {
    const m = Math.floor(tri.length / 2);
    return tri.length % 2 ? tri[m] : (tri[m - 1] + tri[m]) / 2;
  }
  return tri[Math.min(tri.length - 1, Math.ceil(q * tri.length) - 1)]; // rang le plus proche
}

async function lancerCas(cas: Cas, top1Passe: Map<number, string>) {
  compteurs = nouveauxCompteurs();
  reseauCoupe = !!cas.regles.horsLigne;
  let result: SearchResult | null = null;
  let erreur: Erreur | null = null;
  const debut = performance.now();
  try {
    result = await findProposals({ title: cas.titre, artist: cas.artiste, year: cas.annee });
  } catch (error) {
    erreur =
      error instanceof ArtworkSearchError
        ? { type: error.kind, message: error.message, plantage: false }
        : { type: 'inattendue', message: error instanceof Error ? error.message : String(error), plantage: true };
  }
  const ms = Math.round(performance.now() - debut);
  reseauCoupe = false;

  const props = result?.proposals ?? [];
  const decision = decisionEcran(cas, result);
  const v = verdict(cas, props, decision, erreur);
  if (props[0]) top1Passe.set(cas.n, props[0].id);
  const ref = cas.regles.memeQue;
  return {
    n: cas.n,
    categorie: cas.categorie,
    saisie: { titre: cas.titre, artiste: cas.artiste, annee: cas.annee },
    attendu: cas.attendu,
    verdict: v.ok ? 'OK' : 'KO',
    raisons: v.raisons,
    decisionEcran: decision,
    messageEcran: erreur ? messageEcran(erreur.type) : null,
    erreur,
    tempsMs: ms,
    appels: { wikimedia: compteurs.wikimedia, gemini: compteurs.gemini, autres: compteurs.autres },
    statutsGemini: compteurs.statutsGemini,
    tokens: {
      entree: compteurs.tokensEntree,
      sortie: compteurs.tokensSortie,
      reflexion: compteurs.tokensReflexion,
      total: compteurs.tokensTotal,
    },
    pistesIA: compteurs.pistesIA,
    tropHomonymes: result?.tooManyHomonyms ?? null,
    nbPropositions: props.length,
    top3: dansTop3(cas, props),
    memeTop1QueReference: ref !== undefined && props[0] ? props[0].id === top1Passe.get(ref) : null,
    fauxPositifs: fauxPositifs(cas, props),
    propositions: props.map((p) => ({
      id: p.id,
      titre: p.title,
      artiste: p.artist,
      annee: p.year,
      lieu: p.location,
      image: !!p.imageFile,
    })),
  };
}

type Resultat = Awaited<ReturnType<typeof lancerCas>>;

function synthese(resultats: Resultat[]) {
  const uniques = resultats.filter((r) => /^(Top-1|Même résultat)/.test(r.attendu));
  const temps = resultats.map((r) => r.tempsMs);
  const somme = (f: (r: Resultat) => number) => resultats.reduce((s, r) => s + f(r), 0);
  const negatifs = resultats.filter((r) => r.n >= 37);
  const avecArtiste = resultats.filter((r) => r.saisie.artiste.trim() && r.n !== 42);
  return {
    casOK: resultats.filter((r) => r.verdict === 'OK').length,
    casTotal: resultats.length,
    reponseUnique: {
      total: uniques.length,
      top1: uniques.filter((r) => r.verdict === 'OK').length,
      top3: uniques.filter((r) => r.top3 === true).length,
    },
    fauxPositifs: {
      casConcernes: avecArtiste.length,
      autreArtiste: avecArtiste.reduce((s, r) => s + r.fauxPositifs.autreArtiste.length, 0),
      autreOeuvre: avecArtiste.reduce((s, r) => s + r.fauxPositifs.autreOeuvre.length, 0),
    },
    cas37a42: { total: negatifs.length, ok: negatifs.filter((r) => r.verdict === 'OK').length },
    tempsMs: { mediane: quantile(temps, 0.5), decile9: quantile(temps, 0.9), max: Math.max(...temps) },
    cout: {
      appelsWikimedia: somme((r) => r.appels.wikimedia),
      appelsGemini: somme((r) => r.appels.gemini),
      tokensTotal: somme((r) => r.tokens.total),
      tokensEntree: somme((r) => r.tokens.entree),
      tokensSortie: somme((r) => r.tokens.sortie),
      tokensReflexion: somme((r) => r.tokens.reflexion),
      parRecherche: {
        appelsWikimedia: +(somme((r) => r.appels.wikimedia) / resultats.length).toFixed(1),
        appelsGemini: +(somme((r) => r.appels.gemini) / resultats.length).toFixed(2),
        tokens: Math.round(somme((r) => r.tokens.total) / resultats.length),
      },
    },
  };
}

async function main() {
  const iaActive = !!process.env.GEMINI_API_KEY?.trim();
  if (!iaActive && process.env.SANS_IA !== '1') {
    console.log('La variable GEMINI_API_KEY est absente : le test ne peut pas utiliser l’IA.');
    console.log('Créez-la puis redémarrez le terminal (ou lancez avec SANS_IA=1 pour tester sans IA).');
    process.exit(1);
  }
  const modele = process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite';
  console.log(`IA : ${iaActive ? `active (modèle ${modele})` : 'désactivée'}`);

  const passes = [];
  for (const [numero, libelle] of [[1, 'sans cache (à froid)'], [2, 'avec cache']] as const) {
    console.log(`\n===== Passe ${numero} : ${libelle} =====`);
    appelsIAPasse = 0;
    appelsIABloques = 0;
    const top1Passe = new Map<number, string>();
    const resultats: Resultat[] = [];
    for (const cas of LISTE) {
      const r = await lancerCas(cas, top1Passe);
      resultats.push(r);
      const premier = r.propositions[0];
      console.log(
        `${String(cas.n).padStart(2)} ${r.verdict} ${String(r.tempsMs).padStart(6)} ms | ` +
          `${r.appels.wikimedia} wm + ${r.appels.gemini} ia | ${r.tokens.total} tk | ` +
          `${r.nbPropositions} prop. | ${premier ? `${premier.titre} — ${premier.artiste} — ${premier.lieu || '?'}` : r.erreur ? `erreur ${r.erreur.type}` : '—'}` +
          (r.raisons.length ? `\n      → ${r.raisons.join(' ; ')}` : '')
      );
      await attendre(PAUSE_MS);
    }
    const s = synthese(resultats);
    console.log(`Bilan passe ${numero} : ${s.casOK}/${s.casTotal} OK, appels IA ${appelsIAPasse} (bloqués : ${appelsIABloques})`);
    passes.push({ numero, cache: numero === 2, appelsIA: appelsIAPasse, appelsIABloques, synthese: s, cas: resultats });
  }

  const sortie = {
    date: new Date().toISOString(),
    node: process.version,
    ia: iaActive ? { active: true, modele } : { active: false },
    pauseEntreCasMs: PAUSE_MS,
    passes,
  };
  writeFileSync(new URL('./resultats.json', import.meta.url), `${JSON.stringify(sortie, null, 2)}\n`);
  console.log('\nRésultats écrits dans tests/recherche/resultats.json');
}

main().catch((error) => {
  console.error('Le test s’est arrêté :', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
