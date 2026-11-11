import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/db/database';
import Cartel from './Cartel';

const FRAME = '#CFC8BA';
const PLACEHOLDER_BG = '#E3DDD1';
const ACCENT = '#7B3F3A';

// Rapport hauteur / largeur maximal : au-delà, l'œuvre est rétrécie
// (jamais recadrée) pour rester entière à l'écran.
const MAX_HEIGHT_RATIO = 1.35;

type Props = {
  artwork: Artwork;
  // Largeur maximale de l'œuvre dans la travée.
  maxWidth: number;
};

// Une travée du mur : une œuvre centrée, un cadre fin, un cartel dessous.
export default function WallBay({ artwork, maxWidth }: Props) {
  // Proportions réelles de l'image (largeur / hauteur), carré par défaut.
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    if (!artwork.imageUri) return;
    let active = true;
    Image.getSize(
      artwork.imageUri,
      (w, h) => {
        if (active && w > 0 && h > 0) setAspect(w / h);
      },
      () => {
        // Taille illisible : on garde le format carré.
      },
    );
    return () => {
      active = false;
    };
  }, [artwork.imageUri]);

  // Dimensions qui respectent exactement les proportions de l'image.
  let width = maxWidth;
  let height = width / aspect;
  if (height > maxWidth * MAX_HEIGHT_RATIO) {
    height = maxWidth * MAX_HEIGHT_RATIO;
    width = height * aspect;
  }

  return (
    <View style={styles.bay}>
      <Link href={`/detail/${artwork.id}`} asChild>
        <Pressable style={styles.pressable} accessibilityRole="button">
          <View style={[styles.frame, { width, height }]}>
            {artwork.imageUri ? (
              <Image
                source={{ uri: artwork.imageUri }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderMark}>✦</Text>
              </View>
            )}
          </View>
          <Cartel title={artwork.title} artist={artwork.artist} year={artwork.year} />
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  bay: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  pressable: {
    alignItems: 'center',
  },
  frame: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FRAME,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: PLACEHOLDER_BG,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderMark: {
    fontSize: 36,
    color: ACCENT,
  },
});
