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
import ModeBar from '@/components/gallery/ModeBar';
import TimeSlider from '@/components/gallery/TimeSlider';
import WallBackground from '@/components/gallery/WallBackground';
import { GalleryMode, minutesOfDay, resolveLighting } from '@/utils/ambiance';

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

  // Mode d'affichage : Auto à chaque ouverture de l'onglet, rien n'est mémorisé.
  const [mode, setMode] = useState<GalleryMode>('AUTO');
  const [simulatedMinutes, setSimulatedMinutes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setMode('AUTO');
    }, []),
  );

  // En passant en Time-Travel, le curseur part de l'heure actuelle (arrondie au quart d'heure).
  const changeMode = (next: GalleryMode) => {
    if (next === 'TIME_TRAVEL' && mode !== 'TIME_TRAVEL') {
      setSimulatedMinutes(Math.round(minutesOfDay(new Date()) / 15) * 15);
    }
    setMode(next);
  };

  const lighting = resolveLighting({
    mode,
    realMoment: env.moment,
    realWeather: env.weather,
    simulatedMinutes,
    sunriseMin: env.sunriseMin,
    sunsetMin: env.sunsetMin,
  });

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

  const isEmpty = loaded && artworks.length === 0;
  const { ambiance } = lighting;

  const header = (
    <View style={[styles.header, { paddingTop: isEmpty ? insets.top + spacing.md : spacing.sm }]}>
      <Text style={styles.kicker}>EXPOSITION</Text>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
        Galerie vivante
      </Text>
    </View>
  );

  if (isEmpty) {
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
      {/* Le mur : couche à part, SOUS tout le reste (barre de modes et œuvres). */}
      <WallBackground ambiance={ambiance} />
      {/* Barre de modes, fixe en haut de l'écran. */}
      <View style={[styles.topBar, { paddingTop: insets.top }]}>
        <ModeBar mode={mode} onChange={changeMode} />
        {mode === 'TIME_TRAVEL' ? (
          <TimeSlider minutes={simulatedMinutes} onChange={setSimulatedMinutes} />
        ) : null}
      </View>
      <FlatList
        data={artworks}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        extraData={ambiance}
        renderItem={({ item }) => (
          <WallBay
            artwork={item}
            maxWidth={artworkMaxWidth}
            shadowAngleDeg={ambiance.shadowAngleDeg}
            shadowOffset={ambiance.shadowOffset}
            shadowOpacity={ambiance.shadowOpacity}
          />
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
  topBar: {
    paddingHorizontal: spacing.lg,
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
