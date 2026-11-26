import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { Artwork, getArtworks } from '@/db/database';
import ArtworkGrid, { GRID_GAP } from '@/components/magazine/ArtworkGrid';
import MagazineHeader from '@/components/magazine/MagazineHeader';
import { magazine, SIDE } from '@/components/magazine/styles';
import { artistSummary, inventoryNumbers, worksByArtist } from '@/utils/collection';
import { formatDisplayText } from '@/utils/text';

// Page d'un artiste, « le portrait » du magazine (DESIGN.md, section 5 ter).
// Ouverte en touchant le nom d'un artiste (détail, toutes les œuvres, sommaire de l'accueil).

export default function ArtistScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const artist = typeof name === 'string' ? name : '';
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { width } = useWindowDimensions();
  const columnWidth = (width - SIDE * 2 - GRID_GAP) / 2;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getArtworks()
        .then((rows) => {
          if (active) setArtworks(rows);
        })
        .catch((error) => {
          console.error('Erreur de lecture de la collection', error);
        })
        .finally(() => {
          if (active) setLoaded(true);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const works = useMemo(() => worksByArtist(artworks, artist), [artworks, artist]);
  const numbers = useMemo(() => inventoryNumbers(artworks), [artworks]);
  // Nom tel qu'il est écrit dans les fiches (sinon celui reçu).
  const displayName = works[0]?.artist.trim() || artist;

  return (
    <View style={magazine.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <MagazineHeader label="ARTISTE" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <Text style={magazine.kicker}>PORTRAIT</Text>
          <Text style={magazine.pageTitle}>{formatDisplayText(displayName)}</Text>
          {works.length > 0 ? <Text style={styles.summary}>{artistSummary(works)}</Text> : null}
        </View>

        {works.length > 0 ? (
          <View style={magazine.section}>
            <Text style={magazine.sectionLabel}>SES ŒUVRES</Text>
            <View style={styles.gridWrap}>
              <ArtworkGrid artworks={works} columnWidth={columnWidth} numbers={numbers} />
            </View>
          </View>
        ) : loaded ? (
          <Text style={styles.empty}>Aucune œuvre de cet artiste dans votre collection.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  head: {
    paddingHorizontal: SIDE,
    paddingTop: 20,
  },
  summary: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 12,
  },
  gridWrap: {
    paddingTop: 16,
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 32,
    paddingHorizontal: SIDE,
  },
});
