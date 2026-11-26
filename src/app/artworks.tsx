import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { colors, fonts, spacing } from '@/theme';
import { Artwork, getArtworks } from '@/db/database';
import ArtworkGrid, { GRID_GAP } from '@/components/magazine/ArtworkGrid';
import MagazineHeader from '@/components/magazine/MagazineHeader';
import { magazine, SIDE } from '@/components/magazine/styles';
import {
  countLabel,
  groupByArtist,
  groupByCentury,
  inventoryNumbers,
  type Section,
} from '@/utils/collection';
import { formatDisplayText } from '@/utils/text';

// « Toutes les œuvres », les archives du magazine (DESIGN.md, section 3 bis).
// Ouvert depuis l'accueil ; « ?vue=siecle » ou « ?vue=artiste » choisit le classement.

type ViewMode = 'tout' | 'artiste' | 'siecle';

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: 'tout', label: 'TOUT' },
  { key: 'artiste', label: 'PAR ARTISTE' },
  { key: 'siecle', label: 'PAR SIÈCLE' },
];

function initialView(value: string | undefined): ViewMode {
  return value === 'artiste' || value === 'siecle' ? value : 'tout';
}

export default function ArtworksScreen() {
  const params = useLocalSearchParams<{ vue?: string }>();
  const [view, setView] = useState<ViewMode>(() => initialView(params.vue));
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const { width } = useWindowDimensions();
  const columnWidth = (width - SIDE * 2 - GRID_GAP) / 2;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getArtworks()
        .then((rows) => {
          if (active) setArtworks(rows);
        })
        .catch((error) => {
          console.error('Erreur de lecture de la collection', error);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const numbers = useMemo(() => inventoryNumbers(artworks), [artworks]);
  const sections: Section[] = useMemo(() => {
    if (view === 'artiste') return groupByArtist(artworks);
    if (view === 'siecle') return groupByCentury(artworks);
    return [];
  }, [artworks, view]);

  return (
    <View style={magazine.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <MagazineHeader label="COLLECTION" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          <View style={magazine.kickerRow}>
            <Text style={magazine.kicker}>LES ARCHIVES</Text>
            <Text style={magazine.kicker}>{countLabel(artworks.length).toUpperCase()}</Text>
          </View>
          <Text style={magazine.pageTitle}>Toutes les œuvres</Text>
        </View>

        {/* Classements : un seul ouvert à la fois, souligné */}
        <View style={styles.tabs} accessibilityRole="tablist">
          {VIEWS.map((item) => {
            const selected = item.key === view;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setView(item.key)}
                style={[styles.tab, selected && styles.tabSelected]}
              >
                <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {view === 'tout' ? (
          <View style={styles.gridWrap}>
            <ArtworkGrid artworks={artworks} columnWidth={columnWidth} numbers={numbers} />
          </View>
        ) : (
          sections.map((section) => (
            <View key={section.key} style={styles.group}>
              <View style={styles.groupHead}>
                {view === 'artiste' && section.key ? (
                  <Link href={`/artist/${encodeURIComponent(section.title)}`} asChild>
                    <Pressable accessibilityRole="link" style={({ pressed }) => [styles.groupLink, pressed && magazine.pressed]}>
                      <Text style={[styles.groupTitle, styles.groupTitleLink]}>{formatDisplayText(section.title)}</Text>
                    </Pressable>
                  </Link>
                ) : (
                  <Text style={styles.groupTitle}>{formatDisplayText(section.title)}</Text>
                )}
                <Text style={styles.groupCount}>{countLabel(section.works.length)}</Text>
              </View>
              <ArtworkGrid artworks={section.works} columnWidth={columnWidth} numbers={numbers} />
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
  },
  head: {
    paddingHorizontal: SIDE,
    paddingTop: 20,
  },
  tabs: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 20,
    marginHorizontal: SIDE,
    borderTopWidth: 2,
    borderTopColor: colors.textPrimary,
  },
  tab: {
    height: 48,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabSelected: {
    borderBottomColor: colors.textPrimary,
  },
  tabText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  tabTextSelected: {
    fontFamily: fonts.medium,
    color: colors.textPrimary,
  },
  gridWrap: {
    paddingHorizontal: SIDE,
    paddingTop: 20,
  },
  group: {
    marginTop: 28,
    paddingHorizontal: SIDE,
  },
  groupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  groupLink: {
    flexShrink: 1,
    minHeight: 44,
    justifyContent: 'flex-end',
  },
  groupTitle: {
    flexShrink: 1,
    fontFamily: fonts.medium,
    fontSize: 20,
    lineHeight: 25,
    color: colors.textPrimary,
  },
  groupTitleLink: {
    textDecorationLine: 'underline',
  },
  groupCount: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
