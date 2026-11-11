import Feather from '@expo/vector-icons/Feather';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Artwork, getArtworks } from '@/db/database';
import WallBay from '@/components/gallery/WallBay';
import { fonts, spacing } from '@/theme';
import { useGalleryEnvironment } from '@/hooks/useGalleryEnvironment';

// TEMPORAIRE (étape 2) : minutes depuis minuit → « 14:05 », ou « ? ».
function formatClock(minutes: number | null): string {
  if (minutes == null) return '?';
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// Couleurs de la charte DESIGN.md.
const WALL = '#F6F2EA';
const TEXT_PRIMARY = '#1C1B19';
const TEXT_SECONDARY = '#7A756B';
const ACCENT = '#7B3F3A';
const ON_ACCENT = '#F6F2EA';
const FIELD_LINE = '#CFC8BA';

// Part de la largeur d'écran occupée au maximum par une œuvre.
const ARTWORK_WIDTH_RATIO = 0.72;

export default function LivingGalleryScreen() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loaded, setLoaded] = useState(false);
  const insets = useSafeAreaInsets();
  const env = useGalleryEnvironment();
  const { width: screenWidth } = useWindowDimensions();
  const artworkMaxWidth = Math.round(screenWidth * ARTWORK_WIDTH_RATIO);

  // Recharge les œuvres chaque fois que l'onglet redevient visible.
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
    }, []),
  );

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <Text style={styles.kicker}>EXPOSITION</Text>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
        Galerie vivante
      </Text>
      {/* TEMPORAIRE (étape 2) : état de l'environnement, retiré à l'étape 4. */}
      <Text style={styles.debug}>
        {`${env.moment} · ${env.weather} · ${formatClock(env.now.getHours() * 60 + env.now.getMinutes())}` +
          ` · lever ${formatClock(env.sunriseMin)} · coucher ${formatClock(env.sunsetMin)}`}
      </Text>
    </View>
  );

  if (loaded && artworks.length === 0) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.emptyBody}>
          <Text style={styles.emptyText}>Votre collection est encore vide.</Text>
          <Text style={styles.emptyHint}>
            Commencez à conserver la trace des œuvres qui vous touchent.
          </Text>
          <Link href="/add" asChild>
            <Pressable
              accessibilityLabel="Ajouter une œuvre"
              style={({ pressed }) => [styles.bigAddButton, pressed && styles.pressed]}
            >
              <Feather name="plus" size={48} color={ON_ACCENT} />
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={artworks}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <WallBay artwork={item} maxWidth={artworkMaxWidth} />
        )}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WALL,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  kicker: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 2,
    color: ACCENT,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 32,
    color: TEXT_PRIMARY,
  },
  debug: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginTop: spacing.xs,
  },
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    fontFamily: fonts.title,
    fontSize: 20,
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyHint: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: spacing.xl,
  },
  bigAddButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1,
    borderColor: FIELD_LINE,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  pressed: {
    opacity: 0.85,
  },
});
