// Textes de la section « Utilisation de l'IA » de l'écran Paramètres.
// Les heures sont données à l'heure du téléphone.

import type { ModelStatus } from './quotas.ts';

// Offre gratuite de Gemini : Google peut utiliser les contenus envoyés pour améliorer ses
// produits (page « Pricing » de l'API Gemini, ligne « Used to improve our products » : « Yes »
// pour l'offre gratuite). Affiché près de « Identifier l'œuvre » et dans les paramètres.
export const GOOGLE_FREE_TIER_NOTICE =
  'En offre gratuite, Google peut utiliser les photos envoyées pour améliorer ses produits.';

// « 9 h », « 9 h 05 », « 17 h 30 ».
export function formatHour(ms: number): string {
  const date = new Date(ms);
  const minutes = date.getMinutes();
  return minutes === 0 ? `${date.getHours()} h` : `${date.getHours()} h ${String(minutes).padStart(2, '0')}`;
}

// « 12 / 500 aujourd'hui » (ou « 12 aujourd'hui » si la limite n'est pas connue).
export function usageCountText(status: ModelStatus): string {
  return status.perDay === null ? `${status.used} aujourd’hui` : `${status.used} / ${status.perDay} aujourd’hui`;
}

// État lisible d'un modèle, avec l'heure de retour quand il y en a une.
export function usageStateText(status: ModelStatus): string {
  const at = status.until === null ? '' : formatHour(status.until);
  switch (status.state) {
    case 'disponible':
      return 'Disponible';
    case 'minute':
      return `Pause courte, de retour à ${at}`;
    case 'jour':
      return `Quota du jour atteint, de retour à ${at}`;
    case 'surcharge':
      return `Surchargé, de nouveau essayé à ${at}`;
    case 'indisponible':
      return `Indisponible avec votre clé, de nouveau essayé à ${at}`;
  }
}
