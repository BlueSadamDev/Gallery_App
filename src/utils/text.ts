// Remplace les caractères spéciaux qui empêchent le retour à la ligne,
// et insère un espace de largeur nulle (U+200B) après chaque tiret
// pour que React Native puisse couper le mot au bon endroit.
// N'affecte PAS les données enregistrées (simple affichage).
// (Même logique que l'accueil.)
export function formatDisplayText(text: string): string {
  const cleaned = text
    .replace(/‑/g, '-') // tiret insécable → tiret normal
    .replace(/ /g, ' '); // espace insécable → espace normale
  return cleaned.replace(/-(?!​| |$)/g, '-​');
}

// Titre donné à une photo gardée sans identification (« Conserver comme œuvre inconnue »).
export const UNKNOWN_ARTWORK_TITLE = 'Œuvre inconnue';

// Vrai si le titre est celui d'une œuvre non identifiée (inutile pour une recherche).
export function isUnknownArtworkTitle(title: string): boolean {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/œ/gi, 'oe').trim().toLowerCase() === 'oeuvre inconnue';
}
