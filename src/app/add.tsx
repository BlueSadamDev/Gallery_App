import { Link, router, Stack } from 'expo-router';
import { useState } from 'react';
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
import { addArtwork } from '@/db/database';
import { pickImageFromGallery, takePhotoWithCamera } from '@/utils/images';
import { identifyArtwork, identifyArtworkByTitle } from '@/utils/gemini';
import { getGeminiApiKey } from '@/config/settings';

function SettingsButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable style={styles.settingsButton}>
        <Text style={styles.settingsIcon}>⚙️</Text>
      </Pressable>
    </Link>
  );
}

export default function AddScreen() {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [searching, setSearching] = useState(false);

  const canSave = title.trim().length > 0 && !saving;

  async function handlePickFromGallery() {
    const uri = await pickImageFromGallery();
    if (uri) {
      setImageUri(uri);
      // Complète automatiquement les informations grâce à l'IA Gemini.
      populateFromImage(uri);
    }
  }

  async function handleTakePhoto() {
    const uri = await takePhotoWithCamera();
    if (uri) {
      setImageUri(uri);
      populateFromImage(uri);
    }
  }

  // Envoie la photo à Gemini pour remplir automatiquement les informations.
  async function populateFromImage(uri: string) {
    if (identifying) return;
    const hasKey = await getGeminiApiKey();
    if (!hasKey) {
      Alert.alert(
        'Clé API manquante',
        'Ajoutez d’abord votre clé Gemini dans les paramètres (roue ⚙️).'
      );
      return;
    }
    setIdentifying(true);
    try {
      const info = await identifyArtwork(uri);
      if (info) {
        if (info.title) setTitle(info.title);
        if (info.artist) setArtist(info.artist);
        if (info.year) setYear(info.year);
        if (info.style) setStyle(info.style);
        if (info.description) setDescription(info.description);
        Alert.alert('Œuvre identifiée', 'Les informations ont été complétées automatiquement.');
      } else {
        Alert.alert('Aucun résultat', 'Gemini n’a pas pu identifier cette œuvre.');
      }
    } catch (error) {
      console.error('Erreur de reconnaissance', error);
      const detail =
        error instanceof Error ? ` (${error.message})` : '';
      Alert.alert('Erreur', `Impossible d’identifier l’œuvre. Vérifiez votre connexion.${detail}`);
    } finally {
      setIdentifying(false);
    }
  }

  // Permet de relancer l'identification manuellement (bouton).
  async function handleIdentify() {
    if (!imageUri || identifying) return;
    await populateFromImage(imageUri);
  }

  // Cherche les informations d'une œuvre à partir de son titre via Gemini.
  async function handleSearchByTitle() {
    const query = title.trim();
    if (query.length === 0 || identifying || searching) return;
    const hasKey = await getGeminiApiKey();
    if (!hasKey) {
      Alert.alert(
        'Clé API manquante',
        'Ajoutez d’abord votre clé Gemini dans les paramètres (roue ⚙️).'
      );
      return;
    }
    setSearching(true);
    try {
      const info = await identifyArtworkByTitle(query);
      if (info && (info.title || info.artist || info.year || info.style || info.description)) {
        if (info.title) setTitle(info.title);
        if (info.artist) setArtist(info.artist);
        if (info.year) setYear(info.year);
        if (info.style) setStyle(info.style);
        if (info.description) setDescription(info.description);
        Alert.alert('Œuvre trouvée', 'Les informations ont été complétées automatiquement.');
      } else {
        Alert.alert('Aucun résultat', 'Gemini n’a pas trouvé d’œuvre correspondant à ce titre.');
      }
    } catch (error) {
      console.error('Erreur de recherche par titre', error);
      const detail =
        error instanceof Error ? ` (${error.message})` : '';
      Alert.alert('Erreur', `Impossible de rechercher l’œuvre. Vérifiez votre connexion.${detail}`);
    } finally {
      setSearching(false);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await addArtwork({
        title: title.trim(),
        artist: artist.trim(),
        description: description.trim(),
        year: year.trim(),
        style: style.trim(),
        imageUri,
      });
      router.back();
    } catch (error) {
      console.error('Erreur lors de l’enregistrement', error);
      Alert.alert('Erreur', "Impossible d'enregistrer l'œuvre.");
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
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
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
          {imageUri ? (
            <Pressable
              style={({ pressed }) => [
                styles.identifyButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleIdentify}
              disabled={identifying}
            >
              <Text style={styles.identifyButtonText}>
                {identifying ? 'Identification…' : 'Identifier l’œuvre avec Gemini'}
              </Text>
            </Pressable>
          ) : null}

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
          <Pressable
            style={({ pressed }) => [
              styles.titleSearchButton,
              (searching || title.trim().length === 0) && styles.titleSearchButtonDisabled,
              pressed && !searching && title.trim().length > 0 && styles.buttonPressed,
            ]}
            onPress={handleSearchByTitle}
            disabled={searching || title.trim().length === 0}
          >
            <Text style={styles.titleSearchButtonText}>
              {searching ? 'Recherche en cours…' : 'Chercher avec Gemini'}
            </Text>
          </Pressable>
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
          <Text style={styles.label}>Style</Text>
          <TextInput
            style={styles.input}
            value={style}
            onChangeText={setStyle}
            placeholder="Ex. Renaissance, Impressionnisme…"
            placeholderTextColor={colors.textSecondary}
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
          disabled={!canSave}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
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
  titleSearchButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  titleSearchButtonDisabled: {
    opacity: 0.5,
  },
  titleSearchButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.accent,
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

  identifyButton: {
    backgroundColor: colors.accent,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  identifyButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.onAccent,
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

