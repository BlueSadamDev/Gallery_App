import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts, spacing, radius } from '@/theme';
import { getArtwork, updateArtwork } from '@/db/database';
import { pickImageFromGallery, takePhotoWithCamera } from '@/utils/images';

function SettingsButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable style={styles.settingsButton}>
        <Text style={styles.settingsIcon}>⚙️</Text>
      </Pressable>
    </Link>
  );
}

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(!Number.isNaN(numericId));
  const [saving, setSaving] = useState(false);

  const canSave = title.trim().length > 0 && !saving;

  // Charge l'œuvre existante pour pré-remplir le formulaire.
  useEffect(() => {
    if (Number.isNaN(numericId)) {
      return;
    }
    getArtwork(numericId)
      .then((artwork) => {
        if (artwork) {
          setTitle(artwork.title);
          setArtist(artwork.artist);
          setYear(artwork.year);
          setDescription(artwork.description);
          setImageUri(artwork.imageUri);
        }
      })
      .catch((error) => {
        console.error('Erreur de chargement', error);
      })
      .finally(() => setLoading(false));
  }, [numericId]);

  async function handlePickFromGallery() {
    const uri = await pickImageFromGallery();
    if (uri) setImageUri(uri);
  }

  async function handleTakePhoto() {
    const uri = await takePhotoWithCamera();
    if (uri) setImageUri(uri);
  }

  async function handleSave() {
    if (!canSave || Number.isNaN(numericId)) return;
    setSaving(true);
    try {
      await updateArtwork(numericId, {
        title: title.trim(),
        artist: artist.trim(),
        description: description.trim(),
        year: year.trim(),
        imageUri,
      });
      router.back();
    } catch (error) {
      console.error('Erreur de modification', error);
      Alert.alert('Erreur', 'Impossible de modifier l’œuvre.');
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => <SettingsButton />,
        }}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.imageSection}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={styles.preview}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.preview, styles.previewPlaceholder]}>
                <Text style={styles.previewIcon}>✦</Text>
                <Text style={styles.previewText}>Aucune photo</Text>
              </View>
            )}
            <View style={styles.imageButtonsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.imageButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handlePickFromGallery}
              >
                <Text style={styles.imageButtonText}>Galerie</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.imageButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleTakePhoto}
              >
                <Text style={styles.imageButtonText}>Caméra</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nom de l’œuvre *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex. La Joconde"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Auteur</Text>
            <TextInput
              style={styles.input}
              value={artist}
              onChangeText={setArtist}
              placeholder="Ex. Léonard de Vinci"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Année</Text>
            <TextInput
              style={styles.input}
              value={year}
              onChangeText={setYear}
              placeholder="Ex. 1503"
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Quelques mots sur cette œuvre…"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              !canSave && styles.saveButtonDisabled,
              pressed && canSave && styles.buttonPressed,
            ]}
            onPress={handleSave}
            disabled={!canSave || loading}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Chargement…' : saving ? 'Enregistrement…' : 'Enregistrer'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  imageSection: {
    marginBottom: spacing.lg,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  previewPlaceholder: {
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIcon: {
    fontSize: 40,
    color: colors.accent,
    opacity: 0.5,
  },
  previewText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  imageButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  imageButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.accent,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
  },
  textArea: {
    minHeight: 100,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onAccent,
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


