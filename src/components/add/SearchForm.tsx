// Formulaire de recherche : titre obligatoire, artiste et année facultatifs.

import { View } from 'react-native';
import { Field, LinkButton, Notice, PrimaryButton, SecondaryButton } from './ui';

type Props = {
  title: string;
  artist: string;
  year: string;
  onChange: (field: 'title' | 'artist' | 'year', value: string) => void;
  onSearch: () => void;
  searching: boolean;
  offline: boolean;
  message: string | null;
  // Propositions disponibles malgré les homonymes (« Afficher quand même »).
  onShowAnyway?: () => void;
  // Proposer la saisie manuelle (hors ligne, panne, ou après 2 relances sans succès).
  onManual?: () => void;
};

export function SearchForm(props: Props) {
  const canSearch = props.title.trim().length > 0 && !props.searching && !props.offline;
  return (
    <View>
      {props.offline ? (
        <Notice>Vous êtes hors ligne. Vous pouvez saisir l’œuvre à la main.</Notice>
      ) : null}
      {props.message ? <Notice>{props.message}</Notice> : null}

      <Field
        label="Titre *"
        value={props.title}
        onChangeText={(v) => props.onChange('title', v)}
        placeholder="Ex. La Nuit étoilée"
      />
      <Field
        label="Artiste (facultatif)"
        value={props.artist}
        onChangeText={(v) => props.onChange('artist', v)}
        placeholder="Ex. Van Gogh"
      />
      <Field
        label="Année (facultatif)"
        value={props.year}
        onChangeText={(v) => props.onChange('year', v)}
        placeholder="Ex. 1889"
      />

      <PrimaryButton
        label={props.searching ? 'Recherche…' : 'Rechercher'}
        onPress={props.onSearch}
        disabled={!canSearch}
        loading={props.searching}
      />
      <View style={{ marginTop: 8, gap: 8 }}>
        {props.onShowAnyway ? (
          <SecondaryButton label="Afficher quand même" onPress={props.onShowAnyway} />
        ) : null}
        {props.onManual ? <LinkButton label="Saisir l’œuvre à la main" onPress={props.onManual} /> : null}
      </View>
    </View>
  );
}
