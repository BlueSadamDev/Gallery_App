// Liste des propositions d'œuvres : miniature, titre, artiste, année, lieu.

import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { USER_AGENT, type Proposal } from '@/services/artworkSearch';
import { LinkButton, Notice, palette, SecondaryButton } from './ui';

type Props = {
  proposals: Proposal[];
  hasMore: boolean;
  onSelect: (proposal: Proposal) => void;
  onMore: () => void;
  onNone: () => void;
};

// Miniature avec repli si l'image manque ou ne se charge pas.
function Thumbnail({ uri }: { uri: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[styles.thumb, styles.thumbEmpty]}>
        <Feather name="image" size={20} color={palette.textSecondary} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri, headers: { 'User-Agent': USER_AGENT } }}
      style={styles.thumb}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

export function ProposalList({ proposals, hasMore, onSelect, onMore, onNone }: Props) {
  return (
    <View>
      <Notice>Choisissez l’œuvre qui correspond.</Notice>
      {proposals.map((proposal) => (
        <Pressable
          key={proposal.id}
          accessibilityRole="button"
          onPress={() => onSelect(proposal)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Thumbnail uri={proposal.thumbnailUrl} />
          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={2}>
              {proposal.title || 'Sans titre'}
            </Text>
            <Text style={styles.caption} numberOfLines={1}>
              {[proposal.artist, proposal.year].filter(Boolean).join(', ')}
            </Text>
            {proposal.location ? (
              <Text style={styles.caption} numberOfLines={1}>
                {proposal.location}
              </Text>
            ) : null}
          </View>
          <Feather name="chevron-right" size={18} color={palette.textSecondary} />
        </Pressable>
      ))}
      <View style={styles.actions}>
        {hasMore ? <SecondaryButton label="Voir 5 autres" onPress={onMore} /> : null}
        <LinkButton label="Aucune ne convient" onPress={onNone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.hairline,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.7,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 2,
    backgroundColor: palette.placeholder,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
    color: palette.text,
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: palette.textSecondary,
    marginTop: 2,
  },
  actions: {
    marginTop: 24,
    gap: 8,
  },
});
