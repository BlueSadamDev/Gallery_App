// Fiche d'une œuvre avant enregistrement : petite image, rubriques « LA FICHE » et « EN PLUS »,
// bouton principal en bas. Le bloc image est aussi utilisé par l'écran de modification.

import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { USER_AGENT } from '@/services/artworkSearch';
import { Field, LinkButton, palette, PrimaryButton, Rubric } from './ui';

export type SheetForm = {
  title: string;
  artist: string;
  year: string;
  style: string;
  description: string;
  // Champs facultatifs (rubrique « EN PLUS »).
  technique: string;
  location: string;
  visitDate: string;
};

// Image affichée : distante (Wikimedia, pas encore copiée) ou locale (photo, copie).
export type SheetImage = { kind: 'remote'; url: string } | { kind: 'local'; uri: string } | null;

type Props = {
  form: SheetForm;
  onChange: (field: keyof SheetForm, value: string) => void;
  image: SheetImage;
  canNextImage: boolean;
  onNextImage: () => void;
  // Ma photo à la place de l'image proposée : appareil photo ou galerie.
  onUseMyPhoto: (source: 'camera' | 'gallery') => void;
  // Absent en saisie manuelle (aucune œuvre proposée à refuser).
  onWrongArtwork?: () => void;
  onSave: () => void;
  saving: boolean;
  // Description rédigée par l'IA : 'loading' pendant la rédaction, 'ai' tant qu'elle n'est pas retouchée.
  descriptionState: 'idle' | 'loading' | 'ai';
  onRegenerate?: () => void;
  onClearDescription?: () => void;
};

function imageKey(image: SheetImage): string {
  if (!image) return 'none';
  return image.kind === 'remote' ? image.url : image.uri;
}

// Petite image, jamais recadrée. Remontée à chaque changement d'image (clé),
// ce qui efface une erreur précédente.
function Visual({ image }: { image: SheetImage }) {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return (
      <View style={[styles.visual, styles.visualEmpty]}>
        <Feather name="image" size={22} color={palette.textSecondary} />
        <Text style={styles.visualText}>{failed ? 'Image indisponible' : 'Aucune image'}</Text>
      </View>
    );
  }
  const source =
    image.kind === 'remote'
      ? { uri: image.url, headers: { 'User-Agent': USER_AGENT } }
      : { uri: image.uri };
  return (
    <Image
      source={source}
      style={styles.visual}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

export type ImageChoice = { label: string; onPress: () => void; disabled?: boolean };

// Petite image + lien « Changer l'image », qui déplie les choix dans l'écran
// (pas de fenêtre Android).
export function ImageBlock({
  image,
  choices,
  disabled,
}: {
  image: SheetImage;
  choices: ImageChoice[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.imageRow}>
      <Visual key={imageKey(image)} image={image} />
      <View style={styles.imageSide}>
        <LinkButton
          label="Changer l’image"
          onPress={() => setOpen((v) => !v)}
          disabled={disabled}
          align="left"
        />
        {open
          ? choices.map((choice) => (
              <LinkButton
                key={choice.label}
                label={choice.label}
                align="left"
                disabled={disabled || choice.disabled}
                onPress={() => {
                  setOpen(false);
                  choice.onPress();
                }}
              />
            ))
          : null}
      </View>
    </View>
  );
}

export function ArtworkSheet(props: Props) {
  const { form, onChange, image, canNextImage, saving } = props;
  const canSave = form.title.trim().length > 0 && !saving;

  const choices: ImageChoice[] = [
    { label: 'Image suivante', onPress: props.onNextImage, disabled: !canNextImage },
    { label: 'Appareil photo', onPress: () => props.onUseMyPhoto('camera') },
    { label: 'Galerie', onPress: () => props.onUseMyPhoto('gallery') },
  ];

  return (
    <View>
      <ImageBlock image={image} choices={choices} disabled={saving} />

      <Rubric label="LA FICHE">
        <Field label="Titre *" value={form.title} onChangeText={(v) => onChange('title', v)} />
        <Field label="Artiste" value={form.artist} onChangeText={(v) => onChange('artist', v)} />
        <Field label="Année" value={form.year} onChangeText={(v) => onChange('year', v)} />
        <Field
          label="Style"
          value={form.style}
          onChangeText={(v) => onChange('style', v)}
          placeholder="Ex. Impressionnisme"
        />
        <Field
          label="Description"
          value={form.description}
          onChangeText={(v) => onChange('description', v)}
          placeholder={
            props.descriptionState === 'loading'
              ? 'Rédaction de la description…'
              : 'Quelques mots sur cette œuvre'
          }
          multiline
          hint={props.descriptionState === 'ai' ? 'À vérifier' : undefined}
        />
        {props.onRegenerate ? (
          <View style={styles.descriptionActions}>
            <LinkButton
              label="Régénérer"
              onPress={props.onRegenerate}
              disabled={props.descriptionState === 'loading' || saving}
            />
            <LinkButton
              label="Effacer"
              onPress={props.onClearDescription ?? (() => undefined)}
              disabled={!form.description || saving}
            />
          </View>
        ) : null}
      </Rubric>

      <OptionalFields
        technique={form.technique}
        location={form.location}
        visitDate={form.visitDate}
        onChange={(field, value) => onChange(field, value)}
      />

      <View style={styles.bottom}>
        <PrimaryButton
          label={saving ? 'Enregistrement…' : 'Enregistrer'}
          onPress={props.onSave}
          disabled={!canSave}
          loading={saving}
        />
        {props.onWrongArtwork ? (
          <LinkButton label="Pas la bonne œuvre" onPress={props.onWrongArtwork} disabled={saving} />
        ) : null}
      </View>
    </View>
  );
}

// Rubrique « EN PLUS » (facultatif) : technique, lieu de conservation, date de la visite.
export function OptionalFields(props: {
  technique: string;
  location: string;
  visitDate: string;
  onChange: (field: 'technique' | 'location' | 'visitDate', value: string) => void;
}) {
  return (
    <Rubric label="EN PLUS" right="FACULTATIF">
      <Field
        label="Technique"
        value={props.technique}
        onChangeText={(v) => props.onChange('technique', v)}
        placeholder="Ex. Huile sur toile, marbre"
      />
      <Field
        label="Lieu de conservation"
        value={props.location}
        onChangeText={(v) => props.onChange('location', v)}
        placeholder="Musée, ville"
      />
      <Field
        label="Vue le"
        value={props.visitDate}
        onChangeText={(v) => props.onChange('visitDate', v)}
        placeholder="Date de votre visite, ex. 12 mai 2026"
      />
    </Rubric>
  );
}

const styles = StyleSheet.create({
  imageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginTop: 24,
  },
  visual: {
    width: 120,
    height: 120,
    borderRadius: 2,
    backgroundColor: palette.placeholder,
  },
  visualEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  visualText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: palette.textSecondary,
  },
  imageSide: {
    flex: 1,
  },
  descriptionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 24,
    marginTop: -16,
    marginBottom: 8,
  },
  bottom: {
    marginTop: 16,
  },
});
