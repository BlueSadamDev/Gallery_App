import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

// Fond des œuvres sans image (DESIGN.md).
const PLACEHOLDER_BG = '#E3DDD1';

type Props = {
  uri: string | null;
  // Largeur disponible.
  width: number;
  // Hauteur maximale : une image plus haute est réduite en entier, jamais recadrée.
  maxHeight: number;
  // Position d'une image réduite dans la largeur disponible.
  align?: 'left' | 'center';
};

// Image affichée avec ses vraies proportions (largeur / hauteur), sans recadrage ni fond autour.
export default function NaturalImage({ uri, width, maxHeight, align = 'left' }: Props) {
  // Proportions lues sur le fichier ; carré tant qu'elles ne sont pas connues.
  const [aspect, setAspect] = useState<number | null>(null);

  useEffect(() => {
    setAspect(null);
    if (!uri) return;
    let active = true;
    Image.getSize(
      uri,
      (w: number, h: number) => {
        if (active && w > 0 && h > 0) setAspect(w / h);
      },
      () => {
        // Taille illisible : on garde le format carré.
      },
    );
    return () => {
      active = false;
    };
  }, [uri]);

  if (!uri) {
    return (
      <View style={[styles.placeholder, { width, height: width }]}>
        <Text style={styles.placeholderMark}>✦</Text>
      </View>
    );
  }

  const ratio = aspect ?? 1;
  let imageWidth = width;
  let imageHeight = width / ratio;
  if (imageHeight > maxHeight) {
    imageHeight = maxHeight;
    imageWidth = imageHeight * ratio;
  }

  return (
    <View style={{ width, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
      <Image
        source={{ uri }}
        style={{ width: imageWidth, height: imageHeight }}
        resizeMode="contain"
        // Pas de fondu d'apparition sur Android (il laissait un voile sur l'image).
        fadeDuration={0}
        accessible={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: PLACEHOLDER_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderMark: {
    fontSize: 32,
    color: colors.textSecondary,
  },
});
