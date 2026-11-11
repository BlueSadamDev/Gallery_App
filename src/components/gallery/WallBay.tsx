import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/db/database';
import Cartel from './Cartel';

const FRAME = '#CFC8BA';
const PLACEHOLDER_BG = '#E3DDD1';
const ACCENT = '#7B3F3A';
const SHADOW_COLOR = '#1C1B19';
const SHADOW_FADE_MS = 900;

// Rapport hauteur / largeur maximal : au-delà, l'œuvre est rétrécie
// (jamais recadrée) pour rester entière à l'écran.
const MAX_HEIGHT_RATIO = 1.35;

type Props = {
  artwork: Artwork;
  // Largeur maximale de l'œuvre dans la travée.
  maxWidth: number;
  // Ombre portée sur le mur (direction, longueur, opacité).
  shadowAngleDeg: number;
  shadowOffset: number;
  shadowOpacity: number;
};

// Une travée du mur : une œuvre centrée, un cadre fin, un cartel dessous.
// L'ombre est une vue sombre décalée, placée DERRIÈRE le cadre : elle ne
// recouvre jamais l'image (pas de shadowColor, inopérant sur Android).
export default function WallBay({
  artwork,
  maxWidth,
  shadowAngleDeg,
  shadowOffset,
  shadowOpacity,
}: Props) {
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
          <View style={{ width, height }}>
            {/* 1. Ombre sur le mur, dessinée en premier donc dessous. */}
            <CastShadow
              angleDeg={shadowAngleDeg}
              offset={shadowOffset}
              opacity={shadowOpacity}
            />
            {/* 2. Cadre et œuvre, au-dessus de l'ombre. L'image n'est jamais modifiée. */}
            <View style={[styles.frame, StyleSheet.absoluteFill]}>
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
          </View>
          <Cartel title={artwork.title} artist={artwork.artist} year={artwork.year} />
        </Pressable>
      </Link>
    </View>
  );
}

type ShadowProps = { angleDeg: number; offset: number; opacity: number };

// Ombre portée simulée : deux plaques sombres très transparentes et
// décalées selon l'angle de la lumière (une franche, une diffuse).
// Les changements se font en douceur (animation, pilote natif).
function CastShadow({ angleDeg, offset, opacity }: ShadowProps) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad) * offset;
  const dy = Math.sin(rad) * offset;

  // Valeurs animées créées une seule fois (au premier affichage).
  const [anim] = useState(() => {
    const values = {
      dx: new Animated.Value(dx),
      dy: new Animated.Value(dy),
      opacity: new Animated.Value(opacity),
    };
    return {
      ...values,
      halfDx: Animated.multiply(values.dx, 0.5),
      halfDy: Animated.multiply(values.dy, 0.5),
      softOpacity: Animated.multiply(values.opacity, 0.6),
    };
  });

  useEffect(() => {
    const config = { duration: SHADOW_FADE_MS, useNativeDriver: true };
    const animation = Animated.parallel([
      Animated.timing(anim.dx, { toValue: dx, ...config }),
      Animated.timing(anim.dy, { toValue: dy, ...config }),
      Animated.timing(anim.opacity, { toValue: opacity, ...config }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [dx, dy, opacity, anim]);

  return (
    <>
      {/* Pénombre diffuse : plus grande, plus loin, plus claire. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shadow,
          styles.shadowSoft,
          { opacity: anim.softOpacity, transform: [{ translateX: anim.dx }, { translateY: anim.dy }] },
        ]}
      />
      {/* Ombre franche, proche du cadre. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.shadow,
          { opacity: anim.opacity, transform: [{ translateX: anim.halfDx }, { translateY: anim.halfDy }] },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SHADOW_COLOR,
    borderRadius: 2,
  },
  shadowSoft: {
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 4,
  },
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
