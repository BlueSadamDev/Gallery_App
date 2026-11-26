import Feather from '@expo/vector-icons/Feather';
import { type Href, Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '@/theme';
import { Artwork, getArtworks } from '@/db/database';
import NaturalImage from '@/components/home/NaturalImage';
import ArtworkGrid, { GRID_GAP } from '@/components/magazine/ArtworkGrid';
import { buildSommaire, countLabel, monthLabel, pickCover, type SommaireEntry } from '@/utils/collection';
import { formatDisplayText } from '@/utils/text';

// Accueil « magazine » (DESIGN.md, section Accueil) :
// en-tête X-GALLERY, œuvre à la une, sommaire « Dans votre collection », puis toutes les œuvres.

// Marges latérales.
const SIDE = 20;

// Écran ouvert par une ligne du sommaire.
function sommaireHref(entry: SommaireEntry): Href {
  if (entry.target === 'artist') return `/artist/${encodeURIComponent(entry.title)}`;
  if (entry.target === 'century') return '/artworks?vue=siecle';
  return `/edit/${entry.artworkId}`;
}

function AddButton() {
  return (
    <Link href="/add" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter une œuvre"
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        {/* Petit carré bordeaux de 28 px dans une zone tactile de 48 px. */}
        <View style={styles.addSquare}>
          <Feather name="plus" size={14} color={colors.onAccent} />
        </View>
      </Pressable>
    </Link>
  );
}

function MenuButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Paramètres"
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Feather name="menu" size={20} color={colors.textPrimary} />
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  // Date du jour, relue à chaque retour sur l'écran (la une change chaque jour).
  const [today, setToday] = useState(() => new Date());

  // Recharge la collection à chaque fois que l'écran redevient visible.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setToday(new Date());
      getArtworks()
        .then((rows) => {
          if (active) setArtworks(rows);
        })
        .catch((error) => {
          console.error('Erreur de lecture de la collection', error);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const columnWidth = (width - SIDE * 2 - GRID_GAP) / 2;

  const cover = useMemo(() => pickCover(artworks, today), [artworks, today]);
  const sommaire = useMemo(() => buildSommaire(artworks), [artworks]);
  const coverByline = cover ? [cover.artist.trim(), cover.year.trim()].filter(Boolean).join(', ') : '';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text style={styles.brand} accessibilityRole="header">X-GALLERY</Text>
        <View style={styles.headerActions}>
          {artworks.length > 0 ? <AddButton /> : null}
          <MenuButton />
        </View>
      </View>

      {artworks.length === 0 ? (
        <View style={styles.emptyBody}>
          <Text style={styles.emptyText}>Votre collection est encore vide.</Text>
          <Text style={styles.emptyHint}>
            Commencez à conserver la trace des œuvres qui vous touchent.
          </Text>
          <Link href="/add" asChild>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ajouter une œuvre"
              style={({ pressed }) => [styles.bigAddButton, pressed && styles.pressed]}
            >
              <Feather name="plus" size={40} color={colors.onAccent} />
            </Pressable>
          </Link>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
          {/* 1. À la une */}
          {cover ? (
            <Link href={`/detail/${cover.id}`} asChild>
              <Pressable accessibilityRole="button" accessibilityLabel={`À la une : ${cover.title}`}>
                {cover.imageUri ? (
                  <NaturalImage uri={cover.imageUri} width={width} maxHeight={width * 1.25} align="center" />
                ) : null}
                <View style={styles.coverText}>
                  <View style={styles.kickerRow}>
                    <Text style={styles.kicker}>À LA UNE</Text>
                    <Text style={styles.kicker}>{monthLabel(today)}</Text>
                  </View>
                  <Text style={styles.coverTitle} numberOfLines={4}>
                    {formatDisplayText(cover.title)}
                  </Text>
                  {coverByline ? <Text style={styles.coverByline}>{coverByline}</Text> : null}
                </View>
              </Pressable>
            </Link>
          ) : null}

          {/* 2. Sommaire, calculé sur le téléphone à partir des fiches (sans IA) */}
          {sommaire.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>DANS VOTRE COLLECTION</Text>
              {sommaire.map((entry, index) => (
                <Link key={entry.key} href={sommaireHref(entry)} asChild>
                  <Pressable
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.tocRow,
                      index < sommaire.length - 1 && styles.tocDivider,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.tocNumber}>{String(index + 1).padStart(2, '0')}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tocTitle} numberOfLines={2}>
                        {formatDisplayText(entry.title)}
                      </Text>
                      <Text style={styles.tocSubtitle} numberOfLines={2}>
                        {formatDisplayText(entry.subtitle)}
                      </Text>
                    </View>
                  </Pressable>
                </Link>
              ))}
            </View>
          ) : null}

          {/* 3. Toutes les œuvres, de la plus récente à la plus ancienne */}
          <View style={[styles.section, styles.gridHeader]}>
            <Text style={styles.sectionLabel}>TOUTES LES ŒUVRES</Text>
            <Link href="/artworks" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`Voir les archives : ${countLabel(artworks.length)}`}
                style={({ pressed }) => [styles.countLink, pressed && styles.pressed]}
              >
                <Text style={styles.count}>{countLabel(artworks.length)}</Text>
              </Pressable>
            </Link>
          </View>
          <View style={styles.grid}>
            <ArtworkGrid artworks={artworks} columnWidth={columnWidth} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: SIDE,
    paddingRight: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.textPrimary,
  },
  brand: {
    fontFamily: fonts.titleBold,
    fontSize: 15,
    letterSpacing: 5,
    color: colors.textPrimary,
    lineHeight: 56,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSquare: {
    width: 28,
    height: 28,
    borderRadius: 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
  coverText: {
    paddingHorizontal: SIDE,
    paddingTop: 20,
  },
  kickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kicker: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.textSecondary,
  },
  coverTitle: {
    fontFamily: fonts.medium,
    fontSize: 44,
    lineHeight: 46,
    letterSpacing: -1.2,
    color: colors.textPrimary,
    marginTop: 14,
  },
  coverByline: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: 12,
  },
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
  tocRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 16,
  },
  tocDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  tocNumber: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.accent,
    paddingTop: 5,
  },
  tocTitle: {
    fontFamily: fonts.medium,
    fontSize: 20,
    lineHeight: 25,
    color: colors.textPrimary,
  },
  tocSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginTop: 4,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  countLink: {
    minHeight: 44,
    justifyContent: 'center',
    marginVertical: -14,
  },
  count: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  grid: {
    paddingHorizontal: SIDE,
    paddingTop: spacing.md,
  },
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SIDE,
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    fontFamily: fonts.medium,
    fontSize: 20,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: spacing.xl,
  },
  bigAddButton: {
    width: 96,
    height: 96,
    borderRadius: 2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
});
