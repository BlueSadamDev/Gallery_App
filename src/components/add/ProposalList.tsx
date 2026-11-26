// Liste numérotée des propositions d'œuvres : miniature à gauche, numéro, titre, artiste, année, lieu.

import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fonts } from '@/theme';
import { USER_AGENT, type Proposal } from '@/services/artworkSearch';
import { LinkButton, Notice, palette, Rubric, SecondaryButton } from './ui';

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
  const count = `${proposals.length} PROPOSITION${proposals.length > 1 ? 'S' : ''}`;
  return (
    <Rubric label={count}>
      <Notice>Choisissez l’œuvre qui correspond.</Notice>
      {proposals.map((proposal, index) => (
        <Pressable
          key={proposal.id}
          accessibilityRole="button"
          onPress={() => onSelect(proposal)}
          style={({ pressed }) => [styles.row, index === 0 && styles.firstRow, pressed && styles.pressed]}
        >
          <Thumbnail uri={proposal.thumbnailUrl} />
          <View style={styles.texts}>
            <Text style={styles.number}>{String(index + 1).padStart(2, '0')}</Text>
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
          <Feather name="arrow-right" size={18} color={palette.textSecondary} />
        </Pressable>
      ))}
      <View style={styles.actions}>
        {hasMore ? <SecondaryButton label="Voir 5 autres" onPress={onMore} /> : null}
        <LinkButton label="Aucune ne convient" onPress={onNone} />
      </View>
    </Rubric>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.field,
    minHeight: 48,
  },
  firstRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.field,
  },
  number: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: palette.accent,
    marginBottom: 2,
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
    fontSize: 18,
    lineHeight: 23,
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
