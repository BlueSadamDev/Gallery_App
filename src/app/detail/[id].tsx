import { Link, router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fonts, spacing, radius } from '@/theme';
import { Artwork, deleteArtwork, getArtwork } from '@/db/database';

function SettingsButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable style={styles.settingsButton}>
        <Text style={styles.settingsIcon}>⚙️</Text>
      </Pressable>
    </Link>
  );
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [artwork, setArtwork] = useState<Artwork | null>(null);

  // Charge l'œuvre à chaque fois que l'écran redevient visible
  // (utile après une modification).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      const numericId = Number(id);
      if (Number.isNaN(numericId)) {
        setArtwork(null);
        return;
      }
      getArtwork(numericId)
        .then((row) => {
          if (active) setArtwork(row);
        })
        .catch((error) => {
          console.error('Erreur de chargement de l’œuvre', error);
        });
      return () => {
        active = false;
      };
    }, [id])
  );

  function handleDelete() {
    const numericId = Number(id);
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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => <SettingsButton />,
        }}
      />

      {!artwork ? (
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>Œuvre introuvable.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {artwork.imageUri ? (
            <View style={styles.imageWrap}>
              <Image
                source={{ uri: artwork.imageUri }}
                style={styles.image}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View style={[styles.imageWrap, styles.imagePlaceholder]}>
              <Text style={styles.placeholderIcon}>✦</Text>
            </View>
          )}

          <View style={styles.infoBlock}>
            <Text style={styles.title}>{artwork.title}</Text>
            {artwork.artist ? (
              <Text style={styles.artist}>{artwork.artist}</Text>
            ) : null}
            {artwork.year ? (
              <Text style={styles.year}>{artwork.year}</Text>
            ) : null}
            {artwork.style ? (
              <Text style={styles.styleText}>{artwork.style}</Text>
            ) : null}
            {artwork.description ? (
              <Text style={styles.description}>{artwork.description}</Text>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.editButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() =>
              router.push({
                pathname: '/edit/[id]',
                params: { id: String(artwork.id) },
              })
            }
          >
            <Text style={styles.editButtonText}>Modifier</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>Supprimer</Text>
          </Pressable>
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
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: fonts.title,
    fontSize: 18,
    color: colors.textSecondary,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderIcon: {
    fontSize: 44,
    color: colors.accent,
    opacity: 0.5,
  },
  infoBlock: {
    marginTop: spacing.lg,
  },
  title: {
    fontFamily: fonts.titleBold,
    fontSize: 26,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  artist: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  year: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  styleText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.accent,
    marginBottom: spacing.md,
    textTransform: 'capitalize',
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  editButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  editButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onAccent,
  },
  deleteButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  deleteButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.danger,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  settingsButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  settingsIcon: {
    fontSize: 22,
  },
});



