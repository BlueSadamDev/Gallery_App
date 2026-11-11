import * as Location from 'expo-location';

// Service d'environnement de la Galerie vivante : position approximative
// + météo actuelle et heures de lever / coucher du soleil (Open-Meteo).
//
// Confidentialité :
// - permission « quand l'app est utilisée » uniquement, précision la plus faible ;
// - coordonnées arrondies à 2 décimales (environ 1 km) ;
// - la position n'est jamais enregistrée : elle sert seulement à l'appel Open-Meteo.
//
// Robustesse : aucune erreur n'est remontée. En cas de refus, de panne,
// d'absence de réseau ou de délai dépassé, on renvoie des valeurs neutres
// (météo inconnue → « dégagé », lever 7 h, coucher 19 h).

export type EnvironmentData = {
  weatherCode: number | null; // code WMO, null si inconnu
  sunriseMin: number | null; // minutes depuis minuit, null si inconnu
  sunsetMin: number | null;
};

export const FALLBACK_ENVIRONMENT: EnvironmentData = {
  weatherCode: null,
  sunriseMin: null,
  sunsetMin: null,
};

const REQUEST_TIMEOUT_MS = 5000;
const LOCATION_TIMEOUT_MS = 8000;
const CACHE_DURATION_MS = 30 * 60 * 1000;

// Cache en mémoire uniquement (perdu à la fermeture de l'app).
// Il ne contient que la météo et les heures du soleil, jamais la position.
let cache: { data: EnvironmentData; savedAt: number } | null = null;

// Rejette la promesse si elle dépasse le délai donné.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Délai dépassé')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// « 2026-11-11T07:42 » (heure locale du lieu) → 462 minutes.
function parseLocalTime(iso: unknown): number | null {
  if (typeof iso !== 'string') return null;
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// Position approximative, ou null si refusée / indisponible.
async function getApproximatePosition(): Promise<{ lat: number; lon: number } | null> {
  try {
    let permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) {
      permission = await Location.requestForegroundPermissionsAsync();
    }
    if (!permission.granted) return null;

    // Dernière position connue (rapide), sinon une nouvelle, peu précise.
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: CACHE_DURATION_MS })) ??
      (await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
        LOCATION_TIMEOUT_MS,
      ));
    if (!position) return null;

    return {
      lat: round2(position.coords.latitude),
      lon: round2(position.coords.longitude),
    };
  } catch {
    return null;
  }
}

// Interroge Open-Meteo (délai max 5 s). Renvoie null en cas d'échec.
async function fetchWeather(lat: number, lon: number): Promise<EnvironmentData | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${lat}&longitude=${lon}` +
      '&current=weather_code&daily=sunrise,sunset&timezone=auto';
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const json = await response.json();

    const code = json?.current?.weather_code;
    return {
      weatherCode: typeof code === 'number' ? code : null,
      sunriseMin: parseLocalTime(json?.daily?.sunrise?.[0]),
      sunsetMin: parseLocalTime(json?.daily?.sunset?.[0]),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Point d'entrée : renvoie toujours un résultat, sans jamais lever d'erreur.
export async function loadEnvironment(): Promise<EnvironmentData> {
  try {
    if (cache && Date.now() - cache.savedAt < CACHE_DURATION_MS) {
      return cache.data;
    }
    const position = await getApproximatePosition();
    if (!position) return FALLBACK_ENVIRONMENT;

    const data = await fetchWeather(position.lat, position.lon);
    if (!data) return FALLBACK_ENVIRONMENT;

    cache = { data, savedAt: Date.now() };
    return data;
  } catch {
    return FALLBACK_ENVIRONMENT;
  }
}
