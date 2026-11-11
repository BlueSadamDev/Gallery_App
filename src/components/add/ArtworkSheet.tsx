// Fiche d'une œuvre avant enregistrement : image, champs modifiables, actions.

import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { USER_AGENT } from '@/services/artworkSearch';
import { Field, LinkButton, palette, PrimaryButton, SecondaryButton } from './ui';

export type SheetForm = {
  title: string;
  artist: string;
  year: string;
  style: string;
  description: string;
};

// Image affichée : distante (Wikimedia, pas encore copiée) ou locale (photo, copie).
export type SheetImage = { kind: 'remote'; url: string } | { kind: 'local'; uri: string } | null;

type Props = {
  form: SheetForm;
  onChange: (field: keyof SheetForm, value: string) => void;
  image: SheetImage;
  canNextImage: boolean;
  onNextImage: () => void;
  onUseMyPhoto: () => void;
  // Absent en saisie manuelle (aucune œuvre proposée à refuser).
  onWrongArtwork?: () => void;
  onSave: () => void;
  saving: boolean;
};

function imageKey(image: SheetImage): string {
  if (!image) return 'none';
  return image.kind === 'remote' ? image.url : image.uri;
}

// Remontée à chaque changement d'image (clé), ce qui efface une erreur précédente.
function Visual({ image }: { image: SheetImage }) {
  const [failed, setFailed] = useState(false);

  if (!image || failed) {
    return (
      <View style={[styles.visual, styles.visualEmpty]}>
        <Feather name="image" size={28} color={palette.textSecondary} />
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

export function ArtworkSheet(props: Props) {
  const { form, onChange, image, canNextImage, saving } = props;
  const canSave = form.title.trim().length > 0 && !saving;

  return (
    <View>
      <Visual key={imageKey(image)} image={image} />
      <View style={styles.imageActions}>
        <View style={styles.half}>
          <SecondaryButton
            label="Image suivante"
            onPress={props.onNextImage}
            disabled={!canNextImage}
          />
        </View>
        <View style={styles.half}>
          <SecondaryButton label="Utiliser ma photo" onPress={props.onUseMyPhoto} />
        </View>
      </View>

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
        placeholder="Quelques mots sur cette œuvre"
        multiline
      />

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
  );
}

const styles = StyleSheet.create({
  visual: {
    width: '100%',
    height: 320,
    borderRadius: 2,
    backgroundColor: palette.placeholder,
  },
  visualEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  visualText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: palette.textSecondary,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 32,
  },
  half: {
    flex: 1,
  },
});
