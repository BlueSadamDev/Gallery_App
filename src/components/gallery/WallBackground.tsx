import { LinearGradient } from 'expo-linear-gradient';
import { useLayoutEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ambiance } from '@/utils/ambiance';

// Durée du fondu enchaîné entre deux ambiances.
const FADE_MS = 900;

type Props = {
  ambiance: Ambiance;
};

// Clé qui identifie une ambiance (pour détecter un changement réel).
function ambianceKey(a: Ambiance): string {
  return `${a.wallTop}|${a.wallBottom}|${a.overlayColor}|${a.overlayOpacity}`;
}

// Une couche de mur : dégradé vertical + voile de lumière.
function WallLayer({ ambiance }: Props) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[ambiance.wallTop, ambiance.wallBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: ambiance.overlayColor, opacity: ambiance.overlayOpacity },
        ]}
      />
    </View>
  );
}

// Le mur de la galerie, placé SOUS les œuvres (premier enfant de l'écran).
// Deux couches superposées : l'ancienne ambiance dessous, la nouvelle
// dessus, qui apparaît en fondu (animation d'opacité, pilote natif).
// Rien ici ne touche aux images des œuvres.
export default function WallBackground({ ambiance }: Props) {
  const key = ambianceKey(ambiance);
  const [layers, setLayers] = useState({ under: ambiance, over: ambiance, key });
  // Opacité de la couche du dessus, créée une seule fois.
  const [fade] = useState(() => new Animated.Value(1));

  // Nouvelle ambiance : l'ancienne passe dessous, la nouvelle dessus.
  // (Mise à jour pendant le rendu : schéma React recommandé pour
  // dériver un état d'une prop, sans image intermédiaire.)
  if (layers.key !== key) {
    setLayers({ under: layers.over, over: ambiance, key });
  }

  // Lance le fondu avant l'affichage de la nouvelle couche.
  useLayoutEffect(() => {
    fade.setValue(0);
    const animation = Animated.timing(fade, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [layers.key, fade]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WallLayer ambiance={layers.under} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <WallLayer ambiance={layers.over} />
      </Animated.View>
    </View>
  );
}
