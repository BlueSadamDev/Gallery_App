import Feather from '@expo/vector-icons/Feather';
import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { Artwork, deleteArtwork, getArtworks } from '@/db/database';
import NaturalImage from '@/components/home/NaturalImage';
import MagazineHeader, { HeaderIconButton } from '@/components/magazine/MagazineHeader';
import { magazine, SIDE } from '@/components/magazine/styles';
import {
  formatInventory,
  inventoryNumbers,
  nextArtwork,
  splitLead,
  worksByArtist,
} from '@/utils/collection';
import { formatDisplayText } from '@/utils/text';

// Détail d'une œuvre, « l'article » du magazine (DESIGN.md, section 5).

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);
  const [all, setAll] = useState<Artwork[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { width } = useWindowDimensions();

  // Recharge la collection à chaque retour sur l'écran (utile après une modification).
  // Toute la collection sert au numéro, au nombre d'œuvres de l'artiste et à l'œuvre suivante.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getArtworks()
        .then((rows) => {
          if (active) setAll(rows);
        })
        .catch((error) => {
          console.error('Erreur de chargement de l’œuvre', error);
        })
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const artwork = all.find((a) => a.id === numericId) ?? null;
  const numbers = useMemo(() => inventoryNumbers(all), [all]);
  const next = artwork ? nextArtwork(all, artwork.id) : null;
  const sameArtist = artwork ? worksByArtist(all, artwork.artist).length : 0;
  const { lead, rest } = splitLead(artwork?.description ?? '');

  function handleDelete() {
    Alert.alert(
      'Supprimer cette œuvre ?',
      'Cette action est définitive et ne peut pas être annulée.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteArtwork(numericId);
              router.back();
            } catch (error) {
              console.error('Erreur de suppression', error);
              Alert.alert('Erreur', 'Impossible de supprimer cette œuvre.');
            }
          },
        },
      ]
    );
  }

  function openEdit() {
    router.push({ pathname: '/edit/[id]', params: { id: String(numericId) } });
  }

  // Lignes de l'encadré « Fiche » : une valeur vide s'affiche « À compléter ».
  const fiche: [string, string][] = artwork
    ? [
        ['ARTISTE', artwork.artist.trim()],
        ['ANNÉE', artwork.year.trim()],
        ['STYLE', artwork.style.trim()],
        ['TECHNIQUE', (artwork.technique ?? '').trim()],
        ['LIEU DE CONSERVATION', (artwork.location ?? '').trim()],
        ['VUE LE', (artwork.visitDate ?? '').trim()],
      ]
    : [];
  const ficheIncomplete = fiche.some(([, value]) => !value);

  return (
    <View style={magazine.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <MagazineHeader
        label="COLLECTION"
        right={artwork ? <HeaderIconButton icon="edit-2" label="Modifier l'œuvre" onPress={openEdit} /> : undefined}
      />

      {!artwork ? (
        <View style={styles.centerBox}>
          {loaded ? <Text style={styles.emptyText}>Œuvre introuvable.</Text> : null}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {artwork.imageUri ? (
            <NaturalImage uri={artwork.imageUri} width={width} maxHeight={width * 1.25} align="center" />
          ) : null}

          {/* Titre de l'article */}
          <View style={styles.head}>
            <View style={magazine.kickerRow}>
              <Text style={styles.number}>{formatInventory(numbers.get(artwork.id) ?? 0)}</Text>
              {artwork.year.trim() ? <Text style={magazine.kicker}>{artwork.year.trim()}</Text> : null}
            </View>
            <Text style={styles.title}>{formatDisplayText(artwork.title)}</Text>
            {artwork.artist.trim() ? (
              <>
                <Link href={`/artist/${encodeURIComponent(artwork.artist.trim())}`} asChild>
                  <Pressable accessibilityRole="link" style={({ pressed }) => [styles.artistLink, pressed && magazine.pressed]}>
                    <Text style={styles.artist}>{formatDisplayText(artwork.artist.trim())}</Text>
                  </Pressable>
                </Link>
                {sameArtist >= 2 ? (
                  <Text style={styles.artistCount}>{sameArtist} œuvres dans votre collection</Text>
                ) : null}
              </>
            ) : null}
          </View>

          {/* L'œuvre : chapeau puis texte */}
          {lead || rest ? (
            <View style={magazine.section}>
              <Text style={magazine.sectionLabel}>L&apos;ŒUVRE</Text>
              {lead ? <Text style={styles.lead}>{formatDisplayText(lead)}</Text> : null}
              {rest ? <Text style={styles.body}>{formatDisplayText(rest)}</Text> : null}
            </View>
          ) : null}

          {/* Fiche, façon cartel */}
          <View style={magazine.section}>
            <Text style={magazine.sectionLabel}>FICHE</Text>
            <View style={styles.fiche}>
              {fiche.map(([label, value], index) => (
                <View key={label} style={[styles.ficheRow, index < fiche.length - 1 && styles.ficheDivider]}>
                  <Text style={styles.ficheLabel}>{label}</Text>
                  <Text style={[styles.ficheValue, !value && styles.ficheEmpty]}>
                    {value ? formatDisplayText(value) : 'À compléter'}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={openEdit}
              style={({ pressed }) => [styles.textButton, pressed && magazine.pressed]}
            >
              <Text style={magazine.link}>{ficheIncomplete ? 'Compléter la fiche' : 'Modifier la fiche'}</Text>
            </Pressable>
          </View>

          {/* Œuvre suivante */}
          {next ? (
            <View style={magazine.section}>
              <Text style={magazine.sectionLabel}>ŒUVRE SUIVANTE</Text>
              <Link href={`/detail/${next.id}`} replace asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Œuvre suivante : ${next.title}`}
                  style={({ pressed }) => [styles.nextRow, pressed && magazine.pressed]}
                >
                  {next.imageUri ? <NaturalImage uri={next.imageUri} width={96} maxHeight={120} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.number}>{formatInventory(numbers.get(next.id) ?? 0)}</Text>
                    <Text style={styles.nextTitle} numberOfLines={3}>{formatDisplayText(next.title)}</Text>
                    {next.artist.trim() ? (
                      <Text style={styles.nextArtist} numberOfLines={1}>{formatDisplayText(next.artist.trim())}</Text>
                    ) : null}
                  </View>
                  <Feather name="arrow-right" size={20} color={colors.textPrimary} />
                </Pressable>
              </Link>
            </View>
          ) : null}

          {/* Suppression, en lien discret */}
          <View style={styles.deleteZone}>
            <Pressable
              accessibilityRole="button"
              onPress={handleDelete}
              style={({ pressed }) => [styles.textButton, pressed && magazine.pressed]}
            >
              <Text style={styles.deleteText}>Supprimer l&apos;œuvre</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
  },
  head: {
    paddingHorizontal: SIDE,
    paddingTop: 20,
  },
  number: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 40,
    lineHeight: 43,
    letterSpacing: -1.1,
    color: colors.textPrimary,
    marginTop: 14,
  },
  artistLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 4,
  },
  artist: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
  artistCount: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  lead: {
    fontFamily: fonts.medium,
    fontSize: 19,
    lineHeight: 28,
    color: colors.textPrimary,
    marginTop: 16,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textPrimary,
    marginTop: 14,
  },
  fiche: {
    marginTop: 8,
  },
  ficheRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 16,
    paddingVertical: 13,
  },
  ficheDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  ficheLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  ficheValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textPrimary,
  },
  ficheEmpty: {
    color: colors.textSecondary,
  },
  textButton: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  nextTitle: {
    fontFamily: fonts.medium,
    fontSize: 22,
    lineHeight: 27,
    color: colors.textPrimary,
    marginTop: 4,
  },
  nextArtist: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deleteZone: {
    marginTop: 20,
    marginHorizontal: SIDE,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  deleteText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
  },
});
