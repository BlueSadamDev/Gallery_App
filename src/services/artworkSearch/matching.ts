// Outils de comparaison pour la recherche d'œuvres.
// Ce fichier n'utilise rien de React Native : il peut être testé avec Node.

// Mots de liaison ignorés quand on compare des noms d'artistes.
const PARTICLES = new Set([
  'de', 'du', 'des', 'd', 'la', 'le', 'les', 'l',
  'van', 'von', 'der', 'den', 'da', 'di', 'del', 'della',
  'the', 'of', 'y', 'e', 'et', 'and',
]);

// Met un texte en minuscules, sans accents ni ponctuation.
// « Alexandros d'Antioche » → « alexandros d antioche ».
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Mots significatifs d'un nom (sans les mots de liaison).
function significantTokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((token) => token.length > 0 && !PARTICLES.has(token));
}

// Vrai si l'artiste saisi correspond à l'un des noms connus du créateur.
// Tous les mots importants saisis doivent se retrouver dans un même nom.
// « Van Gogh » correspond à « Vincent van Gogh » ; « Klimt » à « Gustav Klimt ».
export function artistMatches(typed: string, knownNames: string[]): boolean {
  const wanted = significantTokens(typed);
  if (wanted.length === 0) return true;
  return knownNames.some((name) => {
    const tokens = new Set(significantTokens(name));
    return wanted.every((token) => tokens.has(token));
  });
}

// Lit une année saisie librement.
// « 1889 » → 1889 ; « vers 100 av. J.-C. » → -100 ; « 1907-1908 » → 1907.
// Renvoie null si aucune année n'est lisible.
export function parseYear(text: string): number | null {
  const cleaned = normalize(text);
  const match = cleaned.match(/\d{1,4}/);
  if (!match) return null;
  const value = Number(match[0]);
  const beforeChrist =
    /\b(av|avant|bc|bce|a c)\b/.test(cleaned.slice(match.index ?? 0)) ||
    /^\s*-\s*\d/.test(text);
  return beforeChrist ? -value : value;
}

// Date telle que Wikidata la fournit : une année et une précision
// (9 = année, 8 = décennie, 7 = siècle, 6 = millénaire).
export type WikidataDate = { year: number; precision: number };

// Lit une date Wikidata (« +1889-06-00T00:00:00Z », « -0140-00-00T... »).
export function parseWikidataTime(time: string, precision: number): WikidataDate | null {
  const match = time.match(/^([+-])(\d+)-/);
  if (!match) return null;
  const year = Number(match[2]) * (match[1] === '-' ? -1 : 1);
  return { year, precision };
}

// Tolérance de base demandée : 10 ans. Quand la source ne donne qu'une
// décennie ou un siècle, on élargit d'autant (sinon une date « IIe siècle av. J.-C. »
// ne pourrait jamais correspondre à « vers 100 av. J.-C. »).
export function yearMatches(typedYear: number, dates: WikidataDate[]): boolean {
  if (dates.length === 0) return true; // date inconnue : on ne peut pas exclure
  return dates.some((date) => {
    let tolerance = 10;
    if (date.precision === 8) tolerance += 10;
    else if (date.precision === 7) tolerance += 100;
    else if (date.precision <= 6) tolerance += 1000;
    return Math.abs(date.year - typedYear) <= tolerance;
  });
}

// Texte lisible d'une date Wikidata.
export function formatDate(date: WikidataDate | null): string {
  if (!date) return '';
  const abs = Math.abs(date.year);
  const suffix = date.year < 0 ? ' av. J.-C.' : '';
  if (date.precision >= 9) return `${abs}${suffix}`;
  if (date.precision === 8) return `années ${Math.floor(abs / 10) * 10}${suffix}`;
  if (date.precision === 7) return `${toRoman(Math.max(1, Math.ceil(abs / 100)))}e siècle${suffix}`;
  return `vers ${abs}${suffix}`;
}

// Chiffres romains pour les siècles (1 → I, 19 → XIX).
function toRoman(value: number): string {
  const table: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let rest = value;
  let result = '';
  for (const [amount, letters] of table) {
    while (rest >= amount) {
      result += letters;
      rest -= amount;
    }
  }
  return result;
}
