// Calculs de l'accueil « magazine », faits sur le téléphone à partir des fiches,
// sans IA : l'œuvre à la une du jour et le sommaire « Dans votre collection ».
// Fonctions pures (aucun accès à l'écran ni à la base) : testées dans tests/accueil.

import type { Artwork } from '@/db/database';
import { isUnknownArtworkTitle } from '@/utils/text';

const MONTHS = [
  'JANVIER', 'FÉVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOÛT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DÉCEMBRE',
];

// « NOVEMBRE 2026 » : date affichée à côté de « À LA UNE ».
export function monthLabel(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// Numéro du jour (même valeur toute la journée, heure locale du téléphone).
function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

// Œuvre à la une : une œuvre avec image, différente chaque jour, la même toute la journée.
// Sans aucune image dans la collection, on prend une œuvre sans image.
export function pickCover(artworks: Artwork[], date: Date): Artwork | null {
  const withImage = artworks.filter((a) => a.imageUri);
  const pool = (withImage.length > 0 ? withImage : artworks).slice().sort((a, b) => a.id - b.id);
  if (pool.length === 0) return null;
  return pool[dayNumber(date) % pool.length];
}

// Année lue dans le champ « année » (« 1813 », « vers 1813 », « 1813-1814 », « 450 av. J.-C. »).
export function parseYear(year: string): number | null {
  const match = year.match(/\d{1,4}/);
  if (!match) return null;
  const value = parseInt(match[0], 10);
  return /av(\.|ant)?\s*J/i.test(year) ? -value : value;
}

const ROMAN: [number, string][] = [
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

function toRoman(value: number): string {
  let rest = value;
  let out = '';
  for (const [n, letters] of ROMAN) {
    while (rest >= n) {
      out += letters;
      rest -= n;
    }
  }
  return out;
}

function fromRoman(letters: string): number | null {
  const values: Record<string, number> = { I: 1, V: 5, X: 10 };
  let total = 0;
  for (let i = 0; i < letters.length; i += 1) {
    const current = values[letters[i]];
    const next = values[letters[i + 1]] ?? 0;
    if (!current) return null;
    total += current < next ? -current : current;
  }
  return total > 0 ? total : null;
}

// Siècle d'une œuvre : 19 pour « 1813 », -5 pour « 450 av. J.-C. », 19 pour « XIXe siècle ».
export function centuryOf(year: string): number | null {
  const roman = year.match(/\b([IVX]+)\s*(?:e|ᵉ|er)\s*s/i);
  if (roman && !/\d/.test(year)) {
    const value = fromRoman(roman[1].toUpperCase());
    if (value === null) return null;
    return /av(\.|ant)?\s*J/i.test(year) ? -value : value;
  }
  const parsed = parseYear(year);
  if (parsed === null || parsed === 0) return null;
  const century = Math.floor((Math.abs(parsed) - 1) / 100) + 1;
  return parsed < 0 ? -century : century;
}

// « XIXe siècle », « Ier siècle », « Ve siècle av. J.-C. ».
export function centuryLabel(century: number): string {
  const n = Math.abs(century);
  const label = `${toRoman(n)}${n === 1 ? 'er' : 'e'} siècle`;
  return century < 0 ? `${label} av. J.-C.` : label;
}

// Tri par année croissante, œuvres sans année en dernier.
function byYear(a: Artwork, b: Artwork): number {
  const ya = parseYear(a.year);
  const yb = parseYear(b.year);
  if (ya === null && yb === null) return a.id - b.id;
  if (ya === null) return 1;
  if (yb === null) return -1;
  return ya - yb;
}

// « A et B », « A, B et C ».
function joinFr(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} et ${items[items.length - 1]}`;
}

function artistKey(artist: string): string | null {
  const key = artist.trim().toLowerCase();
  return key === '' || key === 'artiste inconnu' ? null : key;
}

export type SommaireEntry = {
  key: 'artiste' | 'siecle' | 'a-completer';
  title: string;
  subtitle: string;
  artworkId: number;
  // Écran ouvert à l'appui : le détail, ou la modification pour une fiche à compléter.
  target: 'detail' | 'edit';
};

function artistEntry(artworks: Artwork[]): { entry: SommaireEntry; ids: Set<number> } | null {
  const groups = new Map<string, Artwork[]>();
  for (const artwork of artworks) {
    const key = artistKey(artwork.artist);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), artwork]);
  }
  let best: [string, Artwork[]] | null = null;
  for (const group of groups) {
    if (group[1].length < 2) continue;
    if (!best || group[1].length > best[1].length || (group[1].length === best[1].length && group[0] < best[0])) {
      best = group;
    }
  }
  if (!best) return null;
  const works = best[1].slice().sort(byYear);
  const titles = works.slice(0, 2).map((w) => w.title.trim());
  const subtitle = works.length === 2 ? joinFr(titles) : `${works.length} œuvres, dont ${joinFr(titles)}`;
  return {
    entry: { key: 'artiste', title: works[0].artist.trim(), subtitle, artworkId: works[0].id, target: 'detail' },
    ids: new Set(works.map((w) => w.id)),
  };
}

function centuryEntry(artworks: Artwork[], artistIds: Set<number> | null): SommaireEntry | null {
  const groups = new Map<number, Artwork[]>();
  for (const artwork of artworks) {
    const century = centuryOf(artwork.year);
    if (century === null) continue;
    groups.set(century, [...(groups.get(century) ?? []), artwork]);
  }
  let best: [number, Artwork[]] | null = null;
  for (const group of groups) {
    if (group[1].length < 2) continue;
    // Inutile si le siècle ne contient que les œuvres de l'artiste déjà cité.
    if (artistIds && group[1].length === artistIds.size && group[1].every((w) => artistIds.has(w.id))) continue;
    if (!best || group[1].length > best[1].length || (group[1].length === best[1].length && group[0] > best[0])) {
      best = group;
    }
  }
  if (!best) return null;
  const works = best[1].slice().sort(byYear);
  const years = works.map((w) => parseYear(w.year)).filter((y): y is number => y !== null);
  const artists = new Set(works.map((w) => artistKey(w.artist)).filter((k) => k !== null));
  let subtitle = `${works.length} œuvres`;
  if (artists.size >= 2) subtitle += ` de ${artists.size} artistes`;
  if (years.length >= 2) {
    const min = Math.min(...years);
    const max = Math.max(...years);
    if (min > 0) subtitle += min === max ? `, toutes de ${min}` : `, de ${min} à ${max}`;
  }
  return { key: 'siecle', title: `Le ${centuryLabel(best[0])}`, subtitle, artworkId: works[0].id, target: 'detail' };
}

function missingFields(artwork: Artwork): string[] {
  const missing: string[] = [];
  if (isUnknownArtworkTitle(artwork.title) || !artwork.title.trim()) missing.push('le titre');
  if (!artistKey(artwork.artist)) missing.push("l'artiste");
  if (!artwork.year.trim()) missing.push("l'année");
  if (!artwork.description.trim()) missing.push('la description');
  return missing;
}

function toCompleteEntry(artworks: Artwork[]): SommaireEntry | null {
  const incomplete = artworks.filter((a) => missingFields(a).length > 0).sort((a, b) => b.id - a.id);
  if (incomplete.length === 0) return null;
  const artwork = incomplete[0];
  const unnamed = isUnknownArtworkTitle(artwork.title) || !artwork.title.trim();
  let subtitle = `À compléter : ${joinFr(missingFields(artwork))}`;
  if (incomplete.length > 1) subtitle += ` · ${incomplete.length} fiches à compléter`;
  return {
    key: 'a-completer',
    title: unnamed ? 'Une œuvre encore sans nom' : artwork.title.trim(),
    subtitle,
    artworkId: artwork.id,
    target: 'edit',
  };
}

// Sommaire « Dans votre collection » : jusqu'à trois entrées, dans cet ordre :
// 1. l'artiste le plus représenté (au moins 2 œuvres) ;
// 2. le siècle le plus représenté (au moins 2 œuvres) ;
// 3. la fiche la plus récente à compléter.
export function buildSommaire(artworks: Artwork[]): SommaireEntry[] {
  const artist = artistEntry(artworks);
  const entries: (SommaireEntry | null)[] = [
    artist?.entry ?? null,
    centuryEntry(artworks, artist?.ids ?? null),
    toCompleteEntry(artworks),
  ];
  return entries.filter((e): e is SommaireEntry => e !== null);
}
