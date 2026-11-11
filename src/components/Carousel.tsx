import { useState } from 'react';
import { Link } from 'expo-router';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';
import { colors, fonts } from '@/theme';
import { Artwork } from '@/db/database';

// Remplace les caractères spéciaux qui empêchent le retour à la ligne.
function formatDisplayText(text: string): string {
  const cleaned = text
    .replace(/\u2011/g, '-')
    .replace(/\u00A0/g, ' ');
  return cleaned.replace(/-(?!\u200B| |$)/g, '-\u200B');
}

const GAP = 12;
const PLACEHOLDER_BG = '#E3DDD1';
const ACCENT = '#7B3F3A';
const INACTIVE_DOT = '#CFC8BA';

interface CarouselProps {
  items: Artwork[];
}

export default function Carousel({ items }: CarouselProps) {
  const { width } = Dimensions.get('window');
  const cardW = Math.round(width * 0.8);
  const side = (width - cardW) / 2;
  const step = cardW + GAP;
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <View>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item: Artwork) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: side }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e: any) => {
          const pos = e?.target?.scrollPosition?.x ?? 0;
          setCurrentIndex(Math.round(pos / step));
        }}
        renderItem={({ item }: { item: Artwork }) => (
          <Link href={`/detail/${item.id}`} asChild>
            <Pressable style={{ width: cardW }}>
              <View
                style={{
                  height: 260,
                  borderRadius: 2,
                  overflow: 'hidden',
                  backgroundColor: PLACEHOLDER_BG,
                }}
              >
                {item.imageUri ? (
                  <Image
                    source={{ uri: item.imageUri }}
                    resizeMode="contain"
                    style={{ flex: 1 }}
                  />
                ) : (
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 36, color: colors.accent, opacity: 0.5 }}>
                      ✦
                    </Text>
                  </View>
                )}
              </View>
              <Text
                numberOfLines={2}
                style={{
                  marginTop: 10,
                  minHeight: 48,
                  fontFamily: fonts.title,
                  fontSize: 18,
                  lineHeight: 24,
                  color: colors.textPrimary,
                }}
              >
                {formatDisplayText(item.title)}
              </Text>
              {item.artist ? (
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 4,
                    fontSize: 14,
                    lineHeight: 20,
                    fontFamily: fonts.regular,
                    color: colors.textSecondary,
                  }}
                >
                  {formatDisplayText(item.artist)}
                </Text>
              ) : null}
            </Pressable>
          </Link>
        )}
      />
      {/* Points de pagination — flux normal, pas de position absolute */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 6,
          marginTop: 16,
        }}
      >
        {items.map((_, i) => (
          <View
            key={String(i)}
            style={{
              width: i === currentIndex ? 16 : 6,
              height: 6,
              borderRadius: i === currentIndex ? 0 : 3,
              backgroundColor: i === currentIndex ? ACCENT : INACTIVE_DOT,
            }}
          />
        ))}
      </View>
    </View>
  );
}