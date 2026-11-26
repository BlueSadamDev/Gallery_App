import { StyleSheet } from 'react-native';
import { colors, fonts } from '@/theme';

// Styles communs aux pages « magazine » (DESIGN.md) : marges, rubriques, étiquettes, titres.

// Marge latérale de toutes les pages magazine.
export const SIDE = 20;

export const magazine = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Rubrique : filet de 2 px au-dessus, étiquette en capitales.
  section: {
    marginTop: 36,
    marginHorizontal: SIDE,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: colors.textPrimary,
  },
  sectionLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.textPrimary,
  },
  // Petites capitales en texte secondaire (« LES ARCHIVES », « 12 ŒUVRES »).
  kicker: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.textSecondary,
  },
  kickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Titre de page très grand.
  pageTitle: {
    fontFamily: fonts.medium,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.1,
    color: colors.textPrimary,
    marginTop: 12,
  },
  // Lien souligné finement.
  link: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.7,
  },
});
