// Thème central de X-Gallery, aligné sur DESIGN.md (référence unique).

export const colors = {
  // Palette de DESIGN.md : un seul fond pour tous les écrans.
  background: '#F6F2EA',
  // Cartes et formulaires : même fond que l'écran (pas de blanc pur).
  card: '#F6F2EA',
  // Texte principal
  textPrimary: '#1C1B19',
  // Texte secondaire : légendes, aides, icônes
  textSecondary: '#7A756B',
  // Seule couleur d'accent : bouton « + », boutons principaux, liens
  accent: '#7B3F3A',
  // Ancienne couleur d'action (bleue) : alignée sur l'accent
  action: '#7B3F3A',
  // Traits fins et contours
  border: '#E3DDD1',
  // Fond des champs de saisie : celui de l'écran
  inputBackground: '#F6F2EA',
  // Texte sur l'accent
  onAccent: '#F6F2EA',
  // Suppression et réinitialisation
  danger: '#A32D2D',
} as const;

export const fonts = {
  // Titres élégants, style musée (Satoshi Bold)
  title: 'Satoshi-Medium',
  titleBold: 'Satoshi-Bold',
  // Texte simple et lisible (Satoshi)
  regular: 'Satoshi-Regular',
  medium: 'Satoshi-Medium',
  semibold: 'Satoshi-Bold',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Coins : 2 px partout (images, champs, boutons), comme le prévoit DESIGN.md.
export const radius = {
  sm: 2,
  md: 2,
  lg: 2,
} as const;
