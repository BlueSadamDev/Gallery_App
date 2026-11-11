// Logique « pure » de la Galerie vivante : aucun appel réseau, aucun React.
// Les mêmes entrées donnent toujours les mêmes sorties, ce qui permet de
// simuler n'importe quelle heure (mode Time-Travel).

export type Moment = 'MORNING' | 'NOON' | 'GOLDEN_HOUR' | 'NIGHT';
export type Weather = 'CLEAR' | 'CLOUDY' | 'RAINY';

// Lever et coucher par défaut si la météo est indisponible : 7 h et 19 h.
export const DEFAULT_SUNRISE_MIN = 7 * 60;
export const DEFAULT_SUNSET_MIN = 19 * 60;
const MORNING_END_MIN = 11 * 60;

// Minutes écoulées depuis minuit pour une date donnée (heure du téléphone).
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

// Convertit un code météo WMO (Open-Meteo) en météo simplifiée.
// Code inconnu ou absent → « dégagé ». La neige est traitée comme la pluie.
export function weatherFromCode(code: number | null | undefined): Weather {
  if (code == null) return 'CLEAR';
  if (code === 2 || code === 3 || code === 45 || code === 48) return 'CLOUDY';
  if (
    (code >= 51 && code <= 67) || // bruine et pluie
    (code >= 71 && code <= 77) || // neige
    (code >= 80 && code <= 82) || // averses
    (code >= 85 && code <= 86) || // averses de neige
    (code >= 95 && code <= 99) // orages
  ) {
    return 'RAINY';
  }
  return 'CLEAR'; // 0, 1 et tout code inattendu
}

// Détermine le moment de la journée.
// - GOLDEN_HOUR : de 1 h avant le coucher à 30 min après.
// - MORNING : du lever à 11 h.
// - NOON : de 11 h (ou du lever s'il est plus tard) à 1 h avant le coucher.
// - NIGHT : le reste.
export function getMoment(
  minutes: number,
  sunriseMin: number | null = DEFAULT_SUNRISE_MIN,
  sunsetMin: number | null = DEFAULT_SUNSET_MIN,
): Moment {
  const sunrise = sunriseMin ?? DEFAULT_SUNRISE_MIN;
  const sunset = sunsetMin ?? DEFAULT_SUNSET_MIN;
  const m = ((minutes % 1440) + 1440) % 1440;

  if (m >= sunset - 60 && m < sunset + 30) return 'GOLDEN_HOUR';
  if (m >= sunrise && m < MORNING_END_MIN) return 'MORNING';
  if (m >= Math.max(MORNING_END_MIN, sunrise) && m < sunset - 60) return 'NOON';
  return 'NIGHT';
}

// Paramètres d'éclairage du mur (jamais appliqués aux œuvres).
export type Ambiance = {
  wallTop: string; // couleur du haut du dégradé
  wallBottom: string; // couleur du bas du dégradé
  overlayColor: string; // voile de lumière posé sur le mur
  overlayOpacity: number; // 0 à 1
  shadowAngleDeg: number; // direction de l'ombre : 0 = droite, 90 = bas, 180 = gauche
  shadowOffset: number; // longueur du décalage en px
  shadowOpacity: number; // 0 à 1
};

// Mur neutre de la charte (mode Puriste).
export const NEUTRAL_AMBIANCE: Ambiance = {
  wallTop: '#F6F2EA',
  wallBottom: '#F6F2EA',
  overlayColor: '#F6F2EA',
  overlayOpacity: 0,
  shadowAngleDeg: 90,
  shadowOffset: 0,
  shadowOpacity: 0,
};

// Éclairage de base par temps dégagé.
const CLEAR_AMBIANCES: Record<Moment, Ambiance> = {
  // Lumière fraîche et douce venant de la gauche : ombre longue vers la droite.
  MORNING: {
    wallTop: '#F9F3E8',
    wallBottom: '#F1E8D9',
    overlayColor: '#FFF3D6',
    overlayOpacity: 0.12,
    shadowAngleDeg: 35,
    shadowOffset: 14,
    shadowOpacity: 0.1,
  },
  // Lumière haute et franche : ombre courte vers le bas.
  NOON: {
    wallTop: '#FAF7F1',
    wallBottom: '#F3EEE4',
    overlayColor: '#FFFFFF',
    overlayOpacity: 0.08,
    shadowAngleDeg: 90,
    shadowOffset: 6,
    shadowOpacity: 0.12,
  },
  // Lumière chaude et rasante venant de la droite : ombre longue vers la gauche.
  GOLDEN_HOUR: {
    wallTop: '#F6E6CF',
    wallBottom: '#EBCFAE',
    overlayColor: '#F2A65A',
    overlayOpacity: 0.12,
    shadowAngleDeg: 145,
    shadowOffset: 18,
    shadowOpacity: 0.13,
  },
  // Éclairage de salle tamisé, venant d'en haut.
  NIGHT: {
    wallTop: '#DCD5C9',
    wallBottom: '#CFC6B7',
    overlayColor: '#1E2433',
    overlayOpacity: 0.1,
    shadowAngleDeg: 90,
    shadowOffset: 5,
    shadowOpacity: 0.08,
  },
};

// Teinte grise et froide vers laquelle tirent les jours couverts.
const COLD_GREY = '#CDD0CF';
const COLD_OVERLAY = '#56606E';

// Mélange deux couleurs « #RRGGBB » (t = 0 → a, t = 1 → b).
function mixColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => {
    const ca = (pa >> shift) & 0xff;
    const cb = (pb >> shift) & 0xff;
    return Math.round(ca + (cb - ca) * t);
  };
  const value = (channel(16) << 16) | (channel(8) << 8) | channel(0);
  return `#${value.toString(16).padStart(6, '0')}`;
}

// Renvoie l'éclairage du mur pour un moment et une météo.
// Nuages et pluie assombrissent, refroidissent et adoucissent les ombres
// le jour. La nuit reste la nuit, quelle que soit la météo.
export function getAmbiance(moment: Moment, weather: Weather): Ambiance {
  const base = CLEAR_AMBIANCES[moment];
  if (moment === 'NIGHT' || weather === 'CLEAR') return base;

  const strength = weather === 'RAINY' ? 0.55 : 0.3;
  return {
    wallTop: mixColor(base.wallTop, COLD_GREY, strength),
    wallBottom: mixColor(base.wallBottom, COLD_GREY, strength),
    overlayColor: COLD_OVERLAY,
    overlayOpacity: weather === 'RAINY' ? 0.14 : 0.08,
    shadowAngleDeg: base.shadowAngleDeg,
    shadowOffset: Math.round(base.shadowOffset * (weather === 'RAINY' ? 0.4 : 0.7)),
    shadowOpacity: base.shadowOpacity * (weather === 'RAINY' ? 0.5 : 0.75),
  };
}

// --- Modes d'affichage de la galerie ---------------------------------------

export type GalleryMode = 'AUTO' | 'TIME_TRAVEL' | 'PURIST';

export type LightingInput = {
  mode: GalleryMode;
  realMoment: Moment; // moment réel (hook)
  realWeather: Weather; // météo réelle (hook)
  simulatedMinutes: number; // heure choisie au curseur (0 à 1440)
  sunriseMin: number | null;
  sunsetMin: number | null;
};

export type Lighting = {
  moment: Moment;
  weather: Weather;
  ambiance: Ambiance;
};

// Choisit l'éclairage à afficher selon le mode :
// - Auto : état réel ;
// - Time-Travel : heure simulée, météo réelle conservée ;
// - Puriste : mur neutre, aucune ombre.
export function resolveLighting(input: LightingInput): Lighting {
  if (input.mode === 'PURIST') {
    return { moment: input.realMoment, weather: input.realWeather, ambiance: NEUTRAL_AMBIANCE };
  }
  const moment =
    input.mode === 'TIME_TRAVEL'
      ? getMoment(input.simulatedMinutes, input.sunriseMin, input.sunsetMin)
      : input.realMoment;
  return { moment, weather: input.realWeather, ambiance: getAmbiance(moment, input.realWeather) };
}

// Libellé d'heure du curseur : 840 → « 14 h », 855 → « 14 h 15 ».
export function formatHourLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}
