import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNetworkState } from 'expo-network';
import { fonts } from '@/theme';
import {
  Field,
  palette,
  PrimaryButton,
  Rubric,
  ScreenTitle,
  SecondaryButton,
} from '@/components/add/ui';
import { ImageBlock, OptionalFields, type SheetImage } from '@/components/add/ArtworkSheet';
import MagazineHeader from '@/components/magazine/MagazineHeader';
import { SIDE } from '@/components/magazine/styles';
import { getArtwork, updateArtwork } from '@/db/database';
import { pickImageFromGallery, takePhotoWithCamera } from '@/utils/images';
import { downloadImage } from '@/utils/artworkImageSearch';
import { isUnknownArtworkTitle } from '@/utils/text';
import { hasGeminiApiKey } from '@/config/settings';
import { aiErrorMessage } from '@/services/ai';
import {
  ArtworkSearchError,
  describeProposal,
  findProposals,
  type Proposal,
} from '@/services/artworkSearch';
import { describeDifferences, planCompletion } from '@/services/artworkSearch/complete';
import { ProposalList } from '@/components/add/ProposalList';

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
  const [technique, setTechnique] = useState('');
  const [location, setLocation] = useState('');
  const [visitDate, setVisitDate] = useState('');
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
          setTechnique(artwork.technique ?? '');
          setLocation(artwork.location ?? '');
          setVisitDate(artwork.visitDate ?? '');
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
    if (isUnknownArtworkTitle(t)) {
      setCompleteMessage('Donnez d’abord un titre à l’œuvre, puis relancez.');
      return;
    }
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
      // Rien avec l'artiste ou l'année saisis : on cherche sur le titre seul,
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
        setCompleteMessage('Ce titre correspond à de nombreuses œuvres. Ajoutez l’artiste ou l’année, puis relancez.');
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
        filled.push('artiste');
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
            note = '\nWikipédia et Wikidata n’ont rien sur cette œuvre : la description reste vide.';
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
    setCompleteMessage('Ajoutez ou corrigez l’artiste ou l’année, puis relancez.');
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
        technique: technique.trim(),
        location: location.trim(),
        visitDate: visitDate.trim(),
        imageUri: finalImageUri,
      });
      router.back();
    } catch (error) {
      console.error('Erreur de modification', error);
      Alert.alert('Erreur', 'Impossible de modifier l’œuvre.');
      setSaving(false);
    }
  }

  // Image affichée : celle de Wikimedia proposée (pas encore copiée), sinon celle de l'œuvre.
  const shownImage: SheetImage = remoteImageUrl
    ? { kind: 'remote', url: remoteImageUrl }
    : imageUri
      ? { kind: 'local', uri: imageUri }
      : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MagazineHeader label="MODIFICATION" />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ScreenTitle>Modifier l’œuvre</ScreenTitle>

          <ImageBlock
            image={shownImage}
            disabled={saving}
            choices={[
              { label: 'Appareil photo', onPress: handleTakePhoto },
              { label: 'Galerie', onPress: handlePickFromGallery },
            ]}
          />

          <View style={styles.completeSection}>
            <SecondaryButton
              label={completing ? 'Recherche…' : 'Compléter avec l’IA'}
              onPress={handleComplete}
              disabled={!canComplete}
              loading={completing}
            />
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

          <Rubric label="LA FICHE">
            <Field label="Titre *" value={title} onChangeText={setTitle} />
            <Field label="Artiste" value={artist} onChangeText={setArtist} />
            <Field label="Année" value={year} onChangeText={setYear} />
            <Field label="Style" value={style} onChangeText={setStyle} placeholder="Ex. Impressionnisme" />
            <Field
              label="Description"
              value={description}
              onChangeText={(text) => {
                setDescription(text);
                setDescriptionFromAi(false);
              }}
              placeholder="Quelques mots sur cette œuvre"
              multiline
              hint={descriptionFromAi ? 'À vérifier' : undefined}
            />
          </Rubric>

          {/* Champs facultatifs de la rubrique « FICHE » du détail. */}
          <OptionalFields
            technique={technique}
            location={location}
            visitDate={visitDate}
            onChange={(field, value) => {
              if (field === 'technique') setTechnique(value);
              if (field === 'location') setLocation(value);
              if (field === 'visitDate') setVisitDate(value);
            }}
          />

          <View style={styles.bottom}>
            <PrimaryButton
              label={loading ? 'Chargement…' : saving ? 'Enregistrement…' : 'Enregistrer'}
              onPress={handleSave}
              disabled={!canSave || loading}
              loading={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: palette.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SIDE,
    paddingTop: 8,
    paddingBottom: 120,
  },
  completeSection: {
    marginTop: 16,
  },
  completeMessage: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 8,
  },
  bottom: {
    marginTop: 16,
  },
});
