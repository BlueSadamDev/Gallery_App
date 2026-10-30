import Feather from '@expo/vector-icons/Feather';
import { Link, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing, radius } from '@/theme';
import { Artwork, getArtworks } from '@/db/database';

// Couleurs de la charte DESIGN.md utilisées sur l'accueil.
const ACCENT = '#7B3F3A';
const ON_ACCENT = '#F6F2EA';
const ICON_GRAY = '#7A756B';

function SettingsButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable
        style={({ pressed }) => [
          styles.settingsButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Feather name="settings" size={22} color={ICON_GRAY} />
      </Pressable>
    </Link>
  );
}

function AddButton() {
  return (
    <Link href="/add" asChild>
      <Pressable
        style={({ pressed }) => [
          styles.addButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Feather name="plus" size={24} color={ON_ACCENT} />
      </Pressable>
    </Link>
  );
}

export default function HomeScreen() {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [randomSample, setRandomSample] = useState<Artwork[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastCount, setLastCount] = useState(0);

  // Recharge la liste à chaque fois que l'écran redevient visible.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getArtworks()
        .then((rows) => {
          if (!active) return;
          setArtworks(rows);
          // Nouveau tirage au premier chargement ou si la taille a changé.
          if (rows.length > 0 && (lastCount !== rows.length || randomSample.length === 0)) {
            const shuffled = [...rows].sort(() => Math.random() - 0.5);
            setRandomSample(shuffled.slice(0, Math.min(5, shuffled.length)));
            setLastCount(rows.length);
            setCurrentIndex(0);
          } else if (rows.length === 0) {
            setRandomSample([]);
            setLastCount(0);
            setCurrentIndex(0);
          }
        })
        .catch((error) => {
          console.error('Erreur de lecture de la collection', error);
        });
      return () => {
        active = false;
      };
    }, [lastCount, randomSample.length])
  );

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitles}>
            <Text style={styles.kicker}>GALERIE PERSONNELLE</Text>
            <Text style={styles.title}>Ma collection</Text>
          </View>
          <View style={styles.headerActions}>
            {artworks.length > 0 ? <AddButton /> : null}
            <SettingsButton />
          </View>
        </View>
      </View>

      {artworks.length === 0 ? (
        <View style={styles.emptyBody}>
          <Text style={styles.emptyText}>
            Votre collection est encore vide.
          </Text>
          <Text style={styles.emptyHint}>
            Commencez à conserver la trace des œuvres qui vous touchent.
          </Text>
          <Link href="/add" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.bigAddButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Feather name="plus" size={48} color={ON_ACCENT} />
            </Pressable>
          </Link>
        </View>
      ) : (
        <>
          {(() => {
            const screenWidth = Dimensions.get('window').width;
            const cardWidth = screenWidth * 0.8;
            const imageHeight = 175;
            return (
              <>
                <FlatList
                  data={randomSample}
                  keyExtractor={(item) => String(item.id)}
                  horizontal={true}
                  pagingEnabled={true}
                  snapToInterval={cardWidth + spacing.sm}
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e: any) => {
                    const pos = e?.target?.scrollPosition?.x ?? 0;
                    const idx = Math.round(pos / (cardWidth + spacing.sm));
                    if (idx >= 0 && idx < randomSample.length) {
                      setCurrentIndex(idx);
                    }
                  }}
                  style={{ height: imageHeight + 56, marginBottom: spacing.sm }}
                  renderItem={({ item }) => (
                    <Link href={`/detail/${item.id}`} asChild>
                      <Pressable
                        style={{
                          width: cardWidth,
                          height: imageHeight + 48,
                          alignItems: 'center' as 'center',
                        }}
                      >
                        {item.imageUri ? (
                          <Image
                            source={{ uri: item.imageUri }}
                            style={{
                              width: cardWidth - spacing.sm,
                              height: imageHeight,
                              borderRadius: 2,
                              backgroundColor: colors.border,
                            }}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: cardWidth - spacing.sm,
                              height: imageHeight,
                              borderRadius: 2,
                              backgroundColor: colors.border,
                              alignItems: 'center' as 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Text style={{ fontSize: 36, color: colors.accent, opacity: 0.5 }}>
                              ✦
                            </Text>
                          </View>
                        )}
                        <Text
                          style={{
                            fontFamily: fonts.title,
                            fontSize: 16,
                            color: colors.textPrimary,
                            marginTop: spacing.sm,
                          }}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                        {item.artist ? (
                          <Text
                            style={{
                              fontFamily: fonts.regular,
                              fontSize: 13,
                              color: colors.textSecondary,
                              marginTop: 2,
                            }}
                            numberOfLines={1}
                          >
                            {item.artist}
                          </Text>
                        ) : null}
                      </Pressable>
                    </Link>
                  )}
                />
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: spacing.sm,
                    marginBottom: spacing.md,
                  }}
                >
                  {randomSample.map((_, i) => (
                    <View
                      key={String(i)}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: i === currentIndex ? '#7B3F3A' : '#CFC8BA',
                      }}
                    />
                  ))}
                </View>
              </>
            );
          })()}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  header: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitles: {
    flex: 1,
    paddingRight: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  kicker: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.titleBold,
    fontSize: 34,
    color: colors.textPrimary,
  },
  emptyBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    fontFamily: fonts.title,
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
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 90,
  },
  row: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.9,
  },
  thumbWrap: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.border,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  placeholderIcon: {
    fontSize: 36,
    color: colors.accent,
    opacity: 0.5,
  },
  cardText: {
    padding: spacing.md,
  },
  cardTitle: {
    fontFamily: fonts.title,
    fontSize: 16,
    color: colors.textPrimary,
  },
  cardArtist: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
