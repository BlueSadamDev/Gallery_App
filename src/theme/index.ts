// Thème central de l'application "Gallery App"
// Design inspiré d'un musée / d'une galerie d'art : sobre et élégant.

export const colors = {
  // Fond principal : blanc cassé très clair
  background: '#FAFAFA',
  // Fond des cartes et formulaires : blanc pur
  card: '#FFFFFF',
  // Texte principal : presque noir
  textPrimary: '#1A1A1A',
  // Texte secondaire : gris moyen, discret
  textSecondary: '#6B7280',
  // Seule couleur d'accent : brun doré discret (cadres de musée)
  accent: '#8B6F47',
  // Séparateurs et bordures très légères
  border: '#E8E8E8',
  // Couleur des champs de saisie
  inputBackground: '#FFFFFF',
  // Couleur du texte sur l'accent (boutons)
  onAccent: '#FFFFFF',
  // Danger (suppression) : rouge discret
  danger: '#9E2B25',
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

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;
