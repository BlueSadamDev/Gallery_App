import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useNetworkState } from 'expo-network';
import { colors, fonts, spacing, radius } from '@/theme';
import { getArtwork, updateArtwork } from '@/db/database';
import { pickImageFromGallery, takePhotoWithCamera } from '@/utils/images';
import { downloadImage } from '@/utils/artworkImageSearch';
import { hasGeminiApiKey } from '@/config/settings';
import { aiErrorMessage } from '@/services/ai';
import {
  ArtworkSearchError,
  describeProposal,
  findProposals,
  USER_AGENT,
  type Proposal,
} from '@/services/artworkSearch';
import { describeDifferences, planCompletion } from '@/services/artworkSearch/complete';
import { ProposalList } from '@/components/add/ProposalList';

function SettingsButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable style={styles.settingsButton}>
        <Text style={styles.settingsIcon}>⚙️</Text>
      </Pressable>
    </Link>
  );
}

const PAGE_SIZE = 5;

// Message simple quand la recherche d'œuvre échoue.
function searchErrorMessage(error: unknown): string {
  if (error instanceof ArtworkSearchError) {
    if (error.kind === 'offline') return 'Vous êtes hors ligne. Vérifiez votre connexion.';
    if (error.kind === 'busy') return 'Le service de recherche est occupé. Réessayez dans un instant.';
    if (error.kind === 'timeout') return 'Le service de recherche ne répond pas. Réessayez.';
  }
  return 'La recherche n’a pas abouti. Réessayez plus tard.';
}

// Question à deux réponses ; renvoie vrai pour la seconde (`yes`).
function ask(title: string, message: string, no: string, yes: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: no, style: 'cancel', onPress: () => resolve(false) },
        { text: yes, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

function caption(p: Proposal): string {
  return [p.artist, p.year].filter(Boolean).join(', ');
}

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numericId = Number(id);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState('');
  const [description, setDescription] = useState('');
  const [style, setStyle] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(!Number.isNaN(numericId));
  const [saving, setSaving] = useState(false);

  // « Compléter avec l'IA »
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;
  const [completing, setCompleting] = useState(false);
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);
  const [choices, setChoices] = useState<Proposal[] | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Image Wikimedia proposée : copiée dans l'app seulement à l'enregistrement.
  const [remoteImageUrl, setRemoteImageUrl] = useState<string | null>(null);
  // Description rédigée par l'IA : mention « À vérifier », jamais stockée.
  const [descriptionFromAi, setDescriptionFromAi] = useState(false);

  const canSave = title.trim().length > 0 && !saving && !completing;
  const canComplete = title.trim().length > 0 && !completing && !loading && !offline;

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
          setStyle(artwork.style);
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
    if (uri) {
      setImageUri(uri);
      setRemoteImageUrl(null);
    }
  }

  async function handleTakePhoto() {
    const uri = await takePhotoWithCamera();
    if (uri) {
      setImageUri(uri);
      setRemoteImageUrl(null);
    }
  }

  // Cherche l'œuvre (IA + Wikidata) à partir des informations enregistrées.
  async function handleComplete() {
    const t = title.trim();
    if (!t || completing) return;
    if (offline) {
      setCompleteMessage('Vous êtes hors ligne. Vérifiez votre connexion.');
      return;
    }
    if (!(await hasGeminiApiKey())) {
      Alert.alert('Clé manquante', 'Ajoutez votre clé Gemini dans les paramètres.');
      return;
    }
    Keyboard.dismiss();
    setCompleting(true);
    setCompleteMessage(null);
    setChoices(null);
    try {
      let result = await findProposals({ title: t, artist: artist.trim(), year: year.trim() });
      // Rien avec l'auteur ou l'année saisis : on cherche sur le titre seul,
      // pour pouvoir signaler une différence avec Wikidata.
      if (result.proposals.length === 0 && (artist.trim() || year.trim())) {
        result = await findProposals({ title: t });
      }
      if (result.proposals.length === 0) {
        setCompleteMessage(
          'Aucune œuvre trouvée pour ce titre. Vérifiez l’orthographe, puis relancez.' +
            (result.aiError ? `\n${aiErrorMessage(result.aiError)}` : '')
        );
      } else if (result.tooManyHomonyms && !artist.trim() && !year.trim()) {
        setCompleteMessage('Ce titre correspond à de nombreuses œuvres. Ajoutez l’auteur ou l’année, puis relancez.');
      } else if (result.proposals.length === 1) {
        const p = result.proposals[0];
        const use = await ask(
          'Œuvre trouvée',
          `${p.title}${caption(p) ? `, ${caption(p)}` : ''}.\nUtiliser ces informations ?`,
          'Annuler',
          'Utiliser'
        );
        if (use) await applyProposal(p);
      } else {
        setVisibleCount(PAGE_SIZE);
        setChoices(result.proposals);
      }
    } catch (error) {
      setCompleteMessage(searchErrorMessage(error));
    } finally {
      setCompleting(false);
    }
  }

  // Remplit les champs vides, propose l'image et signale les différences.
  async function applyProposal(p: Proposal) {
    setChoices(null);
    setCompleting(true);
    try {
      const plan = planCompletion({ artist, year, hasImage: Boolean(imageUri) }, p);
      const filled: string[] = [];
      if (plan.artist) {
        setArtist(plan.artist);
        filled.push('auteur');
      }
      if (plan.year) {
        setYear(plan.year);
        filled.push('année');
      }
      if (plan.imageUrl) {
        setRemoteImageUrl(plan.imageUrl);
        filled.push('image');
      }
      let note = '';
      if (!description.trim()) {
        try {
          const text = await describeProposal(p);
          if (text) {
            setDescription(text);
            setDescriptionFromAi(true);
            filled.push('description');
          } else {
            note = '\nAucun article Wikipédia trouvé pour cette œuvre : la description reste vide.';
          }
        } catch (error) {
          note = `\nDescription : ${aiErrorMessage(error)}`;
        }
      }
      setCompleteMessage(
        (filled.length > 0
          ? `Complété : ${filled.join(', ')}. Vérifiez avant d’enregistrer.`
          : 'Rien à compléter : les champs sont déjà remplis.') + note
      );
      if (plan.differences.length > 0) {
        const replace = await ask(
          'Différences avec Wikidata',
          `${describeDifferences(plan.differences)}\n\nVos informations sont gardées. Les remplacer ?`,
          'Garder les miennes',
          'Remplacer'
        );
        if (replace) {
          for (const d of plan.differences) {
            if (d.field === 'artist') setArtist(d.found);
            if (d.field === 'year') setYear(d.found);
          }
        }
      }
    } finally {
      setCompleting(false);
    }
  }

  // « Aucune ne convient » : on ferme la liste et on demande de préciser.
  function handleNoneMatches() {
    setChoices(null);
    setCompleteMessage('Ajoutez ou corrigez l’auteur ou l’année, puis relancez.');
  }

  async function handleSave() {
    if (!canSave || Number.isNaN(numericId)) return;
    setSaving(true);
    setDescriptionFromAi(false); // la mention « À vérifier » disparaît à l'enregistrement
    try {
      // Image Wikimedia proposée : copiée dans le stockage de l'app (aucune adresse gardée).
      let finalImageUri = imageUri;
      if (remoteImageUrl) {
        finalImageUri = await downloadImage(remoteImageUrl);
        if (!finalImageUri) {
          const goOn = await ask(
            'Image non copiée',
            'L’image n’a pas pu être téléchargée. Enregistrer l’œuvre sans image ?',
            'Annuler',
            'Enregistrer'
          );
          if (!goOn) {
            setSaving(false);
            return;
          }
          finalImageUri = imageUri;
        }
      }
      await updateArtwork(numericId, {
        title: title.trim(),
        artist: artist.trim(),
        description: description.trim(),
        year: year.trim(),
        style: style.trim(),
        imageUri: finalImageUri,
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
        behavior="padding"
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View>
          <View style={styles.imageSection}>
            {remoteImageUrl ? (
              <Image
                source={{ uri: remoteImageUrl, headers: { 'User-Agent': USER_AGENT } }}
                style={styles.preview}
                resizeMode="contain"
              />
            ) : imageUri ? (
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

          <View style={styles.completeSection}>
            <Pressable
              style={({ pressed }) => [
                styles.completeButton,
                !canComplete && styles.saveButtonDisabled,
                pressed && canComplete && styles.buttonPressed,
              ]}
              onPress={handleComplete}
              disabled={!canComplete}
            >
              <Text style={styles.imageButtonText}>
                {completing ? 'Recherche…' : 'Compléter avec l’IA'}
              </Text>
            </Pressable>
            {completeMessage ? <Text style={styles.completeMessage}>{completeMessage}</Text> : null}
            {choices ? (
              <ProposalList
                proposals={choices.slice(0, visibleCount)}
                hasMore={choices.length > visibleCount}
                onSelect={applyProposal}
                onMore={() => setVisibleCount((n) => n + PAGE_SIZE)}
                onNone={handleNoneMatches}
              />
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
            <View style={styles.labelRow}>
              <Text style={styles.label}>Description</Text>
              {descriptionFromAi ? <Text style={styles.toCheck}>À vérifier</Text> : null}
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setDescriptionFromAi(false);
              }}
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
          </View>
          </TouchableWithoutFeedback>
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
    flexGrow: 1,
    padding: spacing.lg,
    paddingBottom: 180,
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
  completeSection: {
    marginBottom: spacing.lg,
  },
  completeButton: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.md,
    minHeight: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeMessage: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  toCheck: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
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


