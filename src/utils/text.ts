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
