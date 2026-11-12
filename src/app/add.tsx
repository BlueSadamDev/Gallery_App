import { Link, router, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNetworkState } from 'expo-network';
import { addArtwork } from '@/db/database';
import {
  pickImageFromGallery,
  prepareForUpload,
  takePhotoWithCamera,
  takeTemporaryPhoto,
} from '@/utils/images';
import { suggestFromPhoto } from '@/utils/gemini';
import { PhotoIdentify } from '@/components/add/PhotoIdentify';
import { downloadImage } from '@/utils/artworkImageSearch';
import { hasGeminiApiKey } from '@/config/settings';
import {
  ArtworkSearchError,
  commonsImageUrl,
  describeProposal,
  findProposals,
  findProposalsFromHints,
  listArtworkImages,
  type Proposal,
} from '@/services/artworkSearch';
import {
  Eyebrow,
  Notice,
  palette,
  PrimaryButton,
  ScreenTitle,
  SecondaryButton,
} from '@/components/add/ui';
import { SearchForm } from '@/components/add/SearchForm';
import { ProposalList } from '@/components/add/ProposalList';
import { ArtworkSheet, type SheetForm, type SheetImage } from '@/components/add/ArtworkSheet';

// Étapes de l'écran d'ajout.
// choice : deux boutons ; photo : ma photo et identification ; search : formulaire ;
// results : propositions ; sheet : fiche.
type Phase = 'choice' | 'photo' | 'search' | 'results' | 'sheet';

const PAGE_SIZE = 5;
const IMAGE_WIDTH = 1024; // largeur de l'image Wikimedia affichée et copiée
const MAX_MISSES = 3; // recherche initiale + 2 relances sans succès → saisie manuelle

const EMPTY_FORM: SheetForm = { title: '', artist: '', year: '', style: '', description: '' };

function SettingsButton() {
  return (
    <Link href="/settings" asChild>
      <Pressable style={styles.settingsButton} accessibilityLabel="Paramètres">
        <Feather name="settings" size={22} color={palette.textSecondary} />
      </Pressable>
    </Link>
  );
}

// Message simple pour chaque type de panne.
function errorMessage(error: unknown): string {
  if (error instanceof ArtworkSearchError) {
    if (error.kind === 'offline') return 'Vous êtes hors ligne. Vous pouvez saisir l’œuvre à la main.';
    if (error.kind === 'busy') return 'Le service de recherche est occupé. Réessayez dans un instant ou saisissez l’œuvre à la main.';
    if (error.kind === 'timeout') return 'Le service de recherche ne répond pas. Réessayez ou saisissez l’œuvre à la main.';
  }
  return 'La recherche n’a pas abouti. Réessayez ou saisissez l’œuvre à la main.';
}

// Propose l'appareil photo ou la galerie ; renvoie le chemin de la copie locale.
function askForPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    const run = async (pick: () => Promise<string | null>) => {
      try {
        resolve(await pick());
      } catch {
        Alert.alert('Photo', 'Impossible d’ouvrir la photo.');
        resolve(null);
      }
    };
    Alert.alert('Ajouter ma photo', 'D’où vient la photo ?', [
      { text: 'Appareil photo', onPress: () => run(takePhotoWithCamera) },
      { text: 'Galerie', onPress: () => run(pickImageFromGallery) },
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(null) },
    ], { cancelable: true, onDismiss: () => resolve(null) });
  });
}

// Demande une confirmation oui / non.
function confirm(title: string, message: string, yes: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: yes, onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

export default function AddScreen() {
  const network = useNetworkState();
  const offline = network.isConnected === false || network.isInternetReachable === false;

  const [phase, setPhase] = useState<Phase>('choice');
  const [sheetFrom, setSheetFrom] = useState<Phase>('choice');
  const [resultsFrom, setResultsFrom] = useState<Phase>('search');

  // Ma photo (étape 4) : elle reste l'image par défaut de l'œuvre.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cartelUri, setCartelUri] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);

  // Recherche
  const [query, setQuery] = useState({ title: '', artist: '', year: '' });
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manualOffered, setManualOffered] = useState(false);
  const [homonyms, setHomonyms] = useState<Proposal[] | null>(null);
  const [misses, setMisses] = useState(0);
  const [excluded, setExcluded] = useState<string[]>([]);

  // Propositions
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Fiche
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [form, setForm] = useState<SheetForm>(EMPTY_FORM);
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  const [imageIndex, setImageIndex] = useState(0);
  const [sheetImage, setSheetImage] = useState<SheetImage>(null);
  const [saving, setSaving] = useState(false);
  const selectedIdRef = useRef<string | null>(null);

  // Description par l'IA (étape 3). La mention « À vérifier » n'est jamais stockée.
  const [descriptionState, setDescriptionState] = useState<'idle' | 'loading' | 'ai'>('idle');
  const descriptionRequestRef = useRef(0); // ignore les réponses devenues obsolètes

  // ----- Navigation interne (bouton retour d'Android) -----
  const goBack = useCallback((): boolean => {
    if (saving || identifying) return true;
    if (phase === 'sheet') {
      setPhase(sheetFrom);
      return true;
    }
    if (phase === 'results') {
      setPhase(resultsFrom);
      return true;
    }
    if (phase === 'search' || phase === 'photo') {
      setPhase('choice');
      return true;
    }
    return false; // écran de choix : on quitte l'écran d'ajout
  }, [phase, sheetFrom, resultsFrom, saving, identifying]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [goBack]);

  // ----- Recherche -----
  function showProposals(list: Proposal[], from: Phase) {
    setHomonyms(null);
    setProposals(list);
    setVisibleCount(PAGE_SIZE);
    setResultsFrom(from);
    setPhase('results');
  }

  function registerMiss(text: string) {
    const next = misses + 1;
    setMisses(next);
    setMessage(text);
    if (next >= MAX_MISSES) setManualOffered(true);
  }

  async function runSearch() {
    const title = query.title.trim();
    if (!title || searching) return;
    if (offline) {
      setMessage(null);
      setManualOffered(true);
      return;
    }
    setSearching(true);
    setHomonyms(null);
    try {
      const result = await findProposals(
        { title, artist: query.artist.trim(), year: query.year.trim() },
        excluded
      );
      if (result.proposals.length === 0) {
        registerMiss(
          result.aiFailed
            ? 'Aucune œuvre trouvée. La correction automatique n’a pas pu être utilisée : vérifiez l’orthographe du titre, ou ajoutez l’artiste ou l’année.'
            : 'Aucune œuvre trouvée. Ajoutez l’artiste ou l’année, ou corrigez le titre, puis relancez.'
        );
      } else if (result.tooManyHomonyms && !query.artist.trim() && !query.year.trim()) {
        setMessage('Ce titre correspond à de nombreuses œuvres. Précisez l’artiste ou l’année.');
        setHomonyms(result.proposals);
      } else {
        setMessage(null);
        showProposals(result.proposals, 'search');
      }
    } catch (error) {
      setMessage(errorMessage(error));
      setManualOffered(true);
    } finally {
      setSearching(false);
    }
  }

  // « Aucune ne convient » : les œuvres montrées sont exclues, on affine la recherche.
  function handleNoneMatches() {
    const shown = proposals.slice(0, visibleCount).map((p) => p.id);
    setExcluded((list) => [...new Set([...list, ...shown])]);
    setPhase('search');
    registerMiss('Ajoutez l’artiste ou l’année, ou corrigez le titre, puis relancez.');
  }

  // ----- Description -----
  // `explicit` : appui sur « Régénérer » (on informe alors de l'échec éventuel).
  async function generateDescription(proposal: Proposal, explicit: boolean) {
    if (!(await hasGeminiApiKey())) {
      if (explicit) Alert.alert('Clé manquante', 'Ajoutez votre clé Gemini dans les paramètres.');
      return;
    }
    const request = ++descriptionRequestRef.current;
    setDescriptionState('loading');
    let text = '';
    try {
      text = await describeProposal(proposal, explicit);
    } catch {
      text = '';
    }
    // Réponse obsolète (autre œuvre ouverte, texte retouché entre-temps) : ignorée.
    if (request !== descriptionRequestRef.current || selectedIdRef.current !== proposal.id) return;
    if (text) {
      setForm((f) => ({ ...f, description: text }));
      setDescriptionState('ai');
    } else {
      setDescriptionState('idle');
      if (explicit) {
        Alert.alert('Description', 'Pas assez d’informations vérifiées pour rédiger une description.');
      }
    }
  }

  function handleFormChange(field: keyof SheetForm, value: string) {
    if (field === 'description') {
      descriptionRequestRef.current++; // une rédaction en cours n'écrasera pas votre texte
      setDescriptionState('idle');
    }
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleClearDescription() {
    descriptionRequestRef.current++;
    setDescriptionState('idle');
    setForm((f) => ({ ...f, description: '' }));
  }

  // ----- Fiche -----
  function openManual(from: Phase, image: SheetImage = null) {
    descriptionRequestRef.current++;
    setDescriptionState('idle');
    selectedIdRef.current = null;
    setSelected(null);
    setForm({ ...EMPTY_FORM, title: query.title, artist: query.artist, year: query.year });
    setImageFiles([]);
    setImageIndex(0);
    // Ma photo, si j'en ai ajouté une, reste l'image par défaut.
    setSheetImage(image ?? (photoUri ? { kind: 'local', uri: photoUri } : null));
    setSheetFrom(from);
    setPhase('sheet');
  }

  function openProposal(proposal: Proposal) {
    selectedIdRef.current = proposal.id;
    setSelected(proposal);
    setForm({
      ...EMPTY_FORM,
      title: proposal.title,
      artist: proposal.artist === 'Artiste inconnu' ? '' : proposal.artist,
      year: proposal.year,
    });
    const files = proposal.imageFile ? [proposal.imageFile] : [];
    setImageFiles(files);
    setImageIndex(0);
    // Ma photo reste l'image par défaut ; « Image suivante » montre celles de Wikimedia.
    if (photoUri) {
      setSheetImage({ kind: 'local', uri: photoUri });
    } else {
      setSheetImage(files[0] ? { kind: 'remote', url: commonsImageUrl(files[0], IMAGE_WIDTH) } : null);
    }
    setSheetFrom('results');
    setPhase('sheet');

    // Description rédigée à partir des faits trouvés (vide s'il en manque).
    generateDescription(proposal, false);

    // Autres images de l'œuvre, chargées en arrière-plan.
    listArtworkImages(proposal)
      .then((list) => {
        if (selectedIdRef.current === proposal.id && list.length > 0) setImageFiles(list);
      })
      .catch(() => undefined);
  }

  function handleNextImage() {
    if (imageFiles.length === 0) return;
    const showingMine = sheetImage?.kind === 'local';
    const next = showingMine ? imageIndex : (imageIndex + 1) % imageFiles.length;
    setImageIndex(next);
    setSheetImage({ kind: 'remote', url: commonsImageUrl(imageFiles[next], IMAGE_WIDTH) });
  }

  async function handleUseMyPhoto() {
    const uri = await askForPhoto();
    if (uri) setSheetImage({ kind: 'local', uri });
  }

  // « Pas la bonne œuvre » : retour à la liste, l'œuvre est exclue.
  function handleWrongArtwork() {
    if (!selected) return;
    const id = selected.id;
    setExcluded((list) => (list.includes(id) ? list : [...list, id]));
    const remaining = proposals.filter((p) => p.id !== id);
    setProposals(remaining);
    selectedIdRef.current = null;
    setSelected(null);
    if (remaining.length > 0) {
      setPhase('results');
    } else {
      setPhase('search');
      registerMiss('Ajoutez l’artiste ou l’année, ou corrigez le titre, puis relancez.');
    }
  }

  async function handleSave() {
    if (!form.title.trim() || saving) return;
    descriptionRequestRef.current++;
    setDescriptionState('idle'); // la mention « À vérifier » disparaît à l'enregistrement
    setSaving(true);
    try {
      // L'image choisie est copiée dans le stockage de l'app : aucune adresse Internet n'est gardée.
      let imageUri: string | null = null;
      if (sheetImage?.kind === 'local') {
        imageUri = sheetImage.uri;
      } else if (sheetImage?.kind === 'remote') {
        imageUri = await downloadImage(sheetImage.url);
        if (!imageUri) {
          const goOn = await confirm(
            'Image non copiée',
            'L’image n’a pas pu être téléchargée. Enregistrer l’œuvre sans image ?',
            'Enregistrer'
          );
          if (!goOn) {
            setSaving(false);
            return;
          }
        }
      }
      await addArtwork({
        title: form.title.trim(),
        artist: form.artist.trim(),
        year: form.year.trim(),
        style: form.style.trim(),
        description: form.description.trim(),
        imageUri,
      });
      router.back();
    } catch (error) {
      console.error('Erreur lors de l’enregistrement', error);
      Alert.alert('Erreur', 'Impossible d’enregistrer l’œuvre.');
      setSaving(false);
    }
  }

  // ----- Ma photo (étape 4) -----
  async function handleAddPhoto() {
    const uri = await askForPhoto();
    if (!uri) return;
    setPhotoUri(uri);
    setCartelUri(null);
    setMessage(null);
    setManualOffered(false);
    setPhase('photo');
  }

  async function handleTakeCartel() {
    try {
      const uri = await takeTemporaryPhoto();
      if (uri) setCartelUri(uri);
    } catch {
      Alert.alert('Cartel', 'Impossible d’ouvrir l’appareil photo.');
    }
  }

  // Un seul appel par appui, sans relance automatique. Rien ne part sans cet appui.
  async function handleIdentify() {
    if (!photoUri || identifying || offline) return;
    if (!(await hasGeminiApiKey())) {
      Alert.alert('Clé manquante', 'Ajoutez votre clé Gemini dans les paramètres.');
      return;
    }
    setIdentifying(true);
    setMessage(null);
    try {
      const photo = await prepareForUpload(photoUri);
      const cartel = cartelUri ? await prepareForUpload(cartelUri) : null;
      const hints = await suggestFromPhoto(photo, cartel);
      if (!hints) {
        setMessage(
          'L’œuvre n’a pas pu être identifiée avec assez de certitude. Vous pouvez la saisir à la main' +
            (cartelUri ? '.' : ' ou photographier le cartel.')
        );
        return;
      }
      // Les pistes préremplissent la recherche, pour pouvoir l'affiner si besoin.
      setQuery({ title: hints.frenchTitle || hints.originalTitle, artist: '', year: '' });
      const result = await findProposalsFromHints(hints, excluded);
      if (result.proposals.length === 0) {
        setPhase('search');
        registerMiss('Aucune œuvre correspondante trouvée. Précisez l’artiste ou l’année, ou corrigez le titre.');
      } else {
        showProposals(result.proposals, 'photo');
      }
    } catch (error) {
      setMessage(
        error instanceof ArtworkSearchError
          ? errorMessage(error)
          : 'L’identification n’a pas abouti. Vérifiez votre connexion ou saisissez l’œuvre à la main.'
      );
    } finally {
      setIdentifying(false);
    }
  }

  // ----- Affichage -----
  const titles: Record<Phase, string> = {
    choice: 'Ajouter une œuvre',
    photo: 'Ma photo',
    search: 'Rechercher',
    results: 'Propositions',
    sheet: 'Vérifier la fiche',
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: palette.background },
          headerTintColor: palette.text,
          headerRight: () => <SettingsButton />,
        }}
      />
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Eyebrow>Nouvelle œuvre</Eyebrow>
          <ScreenTitle>{titles[phase]}</ScreenTitle>

          {phase === 'choice' ? (
            <View style={styles.choice}>
              <Notice>Retrouvez l’œuvre par son titre, ou partez de votre photo.</Notice>
              <PrimaryButton
                label="Rechercher par titre"
                onPress={() => {
                  setMessage(null);
                  setPhotoUri(null);
                  setCartelUri(null);
                  setPhase('search');
                }}
              />
              <SecondaryButton label="Ajouter ma photo" onPress={handleAddPhoto} />
            </View>
          ) : null}

          {phase === 'photo' && photoUri ? (
            <PhotoIdentify
              photoUri={photoUri}
              cartelUri={cartelUri}
              onTakeCartel={handleTakeCartel}
              onRemoveCartel={() => setCartelUri(null)}
              onIdentify={handleIdentify}
              identifying={identifying}
              offline={offline}
              message={message}
              onManual={() => openManual('photo', { kind: 'local', uri: photoUri })}
            />
          ) : null}

          {phase === 'search' ? (
            <SearchForm
              title={query.title}
              artist={query.artist}
              year={query.year}
              onChange={(field, value) => setQuery((q) => ({ ...q, [field]: value }))}
              onSearch={runSearch}
              searching={searching}
              offline={offline}
              message={message}
              onShowAnyway={homonyms ? () => showProposals(homonyms, 'search') : undefined}
              onManual={manualOffered || offline ? () => openManual('search') : undefined}
            />
          ) : null}

          {phase === 'results' ? (
            <ProposalList
              proposals={proposals.slice(0, visibleCount)}
              hasMore={proposals.length > visibleCount}
              onSelect={openProposal}
              onMore={() => setVisibleCount((n) => n + PAGE_SIZE)}
              onNone={handleNoneMatches}
            />
          ) : null}

          {phase === 'sheet' ? (
            <ArtworkSheet
              form={form}
              onChange={handleFormChange}
              image={sheetImage}
              canNextImage={
                imageFiles.length > 1 || (sheetImage?.kind !== 'remote' && imageFiles.length > 0)
              }
              onNextImage={handleNextImage}
              onUseMyPhoto={handleUseMyPhoto}
              onWrongArtwork={selected ? handleWrongArtwork : undefined}
              onSave={handleSave}
              saving={saving}
              descriptionState={descriptionState}
              onRegenerate={selected ? () => generateDescription(selected, true) : undefined}
              onClearDescription={handleClearDescription}
            />
          ) : null}
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
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 120,
  },
  choice: {
    gap: 12,
  },
  settingsButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
