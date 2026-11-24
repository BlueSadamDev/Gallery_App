// Étape « Ma photo » : la photo de l'œuvre, le cartel facultatif et
// l'identification, qui ne part que sur appui explicite.

import { Image, StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/theme';
import { GOOGLE_FREE_TIER_NOTICE } from '@/services/ai/usage';
import { LinkButton, Notice, palette, PrimaryButton, SecondaryButton } from './ui';

type Props = {
  photoUri: string;
  cartelUri: string | null;
  onTakeCartel: () => void;
  onRemoveCartel: () => void;
  onIdentify: () => void;
  identifying: boolean;
  offline: boolean;
  message: string | null;
  // Texte lu sur la photo (cartel, plaque, inscription) : montré comme une lecture, jamais
  // comme un titre. « Chercher avec ce texte » le reprend dans la recherche, modifiable.
  readText: string | null;
  onUseReadText: () => void;
  onManual: () => void;
};

export function PhotoIdentify(props: Props) {
  return (
    <View>
      <Image source={{ uri: props.photoUri }} style={styles.photo} resizeMode="contain" />

      {props.cartelUri ? (
        <View style={styles.cartelRow}>
          <Image source={{ uri: props.cartelUri }} style={styles.cartel} resizeMode="cover" />
          <Text style={styles.cartelText}>Cartel ajouté</Text>
          <LinkButton label="Retirer" onPress={props.onRemoveCartel} disabled={props.identifying} />
        </View>
      ) : (
        <View style={styles.spaced}>
          <SecondaryButton
            label="Photographier le cartel"
            onPress={props.onTakeCartel}
            disabled={props.identifying}
          />
          <Text style={styles.help}>Facultatif : la petite étiquette à côté de l’œuvre aide à l’identifier.</Text>
        </View>
      )}

      {props.offline ? (
        <Notice>Vous êtes hors ligne. L’identification n’est pas disponible.</Notice>
      ) : null}
      {props.message ? <Notice>{props.message}</Notice> : null}

      {props.readText ? (
        <View style={styles.readBlock}>
          <Text style={styles.readLabel}>Inscription lue</Text>
          <Text style={styles.readText}>« {props.readText} »</Text>
          <LinkButton
            label="Chercher avec ce texte"
            onPress={props.onUseReadText}
            disabled={props.identifying}
          />
        </View>
      ) : null}

      <PrimaryButton
        label={props.identifying ? 'Identification…' : 'Identifier l’œuvre'}
        onPress={props.onIdentify}
        disabled={props.offline}
        loading={props.identifying}
      />
      <Text style={styles.help}>
        La photo est réduite et ses informations de lieu sont retirées avant l’envoi.{' '}
        {GOOGLE_FREE_TIER_NOTICE}
      </Text>
      <LinkButton
        label="Saisir l’œuvre à la main"
        onPress={props.onManual}
        disabled={props.identifying}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: '100%',
    height: 320,
    borderRadius: 2,
    backgroundColor: palette.placeholder,
  },
  spaced: {
    marginTop: 8,
    marginBottom: 24,
  },
  cartelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  cartel: {
    width: 64,
    height: 64,
    borderRadius: 2,
    backgroundColor: palette.placeholder,
  },
  cartelText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: palette.textSecondary,
  },
  readBlock: {
    marginBottom: 16,
  },
  readLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.6,
    color: palette.label,
    marginBottom: 4,
  },
  readText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: palette.text,
  },
  help: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: palette.textSecondary,
    marginTop: 8,
  },
});
