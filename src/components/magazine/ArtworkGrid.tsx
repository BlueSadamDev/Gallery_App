import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import type { Artwork } from '@/db/database';
import NaturalImage from '@/components/home/NaturalImage';
import { formatInventory } from '@/utils/collection';
import { formatDisplayText } from '@/utils/text';

type Props = {
  artworks: Artwork[];
  // Largeur d'une colonne.
  columnWidth: number;
  // Numéros d'inventaire à afficher (N° 01…) ; absents sur l'accueil.
  numbers?: Map<number, number>;
};

// Espace entre les deux colonnes.
export const GRID_GAP = 12;

// Grille « magazine » sur deux colonnes : une œuvre sur deux dans chaque colonne,
// chaque image avec ses vraies proportions (au plus 1,5 × la largeur de la colonne).
export default function ArtworkGrid({ artworks, columnWidth, numbers }: Props) {
  return (
    <View style={styles.grid}>
      {[0, 1].map((column) => (
        <View key={column} style={{ width: columnWidth, gap: spacing.lg }}>
          {artworks
            .filter((_, index) => index % 2 === column)
            .map((artwork) => {
              const number = numbers?.get(artwork.id);
              return (
                <Link key={String(artwork.id)} href={`/detail/${artwork.id}`} asChild>
                  <Pressable accessibilityRole="button" accessibilityLabel={artwork.title}>
                    <NaturalImage
                      uri={artwork.imageUri}
                      width={columnWidth}
                      maxHeight={columnWidth * 1.5}
                    />
                    {number ? <Text style={styles.number}>{formatInventory(number)}</Text> : null}
                    <Text style={[styles.title, !number && styles.titleAlone]} numberOfLines={3}>
                      {formatDisplayText(artwork.title)}
                    </Text>
                    {artwork.artist.trim() ? (
                      <Text style={styles.artist} numberOfLines={1}>
                        {formatDisplayText(artwork.artist)}
                      </Text>
                    ) : null}
                  </Pressable>
                </Link>
              );
            })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: GRID_GAP,
  },
  number: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 1.5,
    color: colors.accent,
    marginTop: 8,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 19,
    color: colors.textPrimary,
    marginTop: 3,
  },
  titleAlone: {
    marginTop: 8,
  },
  artist: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
