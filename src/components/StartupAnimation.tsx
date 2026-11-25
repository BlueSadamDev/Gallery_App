// Animation de démarrage : le logo X-Gallery se dessine, puis le nom apparaît.
// 1. le cadre se trace (haut, droite, bas, gauche) ;
// 2. le trait épais du X, puis le trait fin ;
// 3. « X-GALLERY » apparaît ; puis tout s'efface en fondu sur l'écran suivant.
// Dessiné avec de simples vues animées : aucune bibliothèque ajoutée.
// Si le téléphone demande de réduire les animations, le logo s'affiche tel quel.

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, fonts } from '@/theme';

// Durées (millisecondes).
const DRAW_MS = 1100; // dessin complet du logo et apparition du nom
const HOLD_MS = 250; // pause sur le logo terminé
const FADE_MS = 300; // fondu de sortie

// Géométrie du logo (mêmes proportions que l'icône) : un carré de 46 unités,
// trait de 2,5 ; diagonales de 26 unités de côté, traits de 7 et 2,2.
const FRAME = 120; // largeur du carré à l'écran, en points
const S = FRAME / 46; // taille d'une unité
const EDGE = 2.5 * S; // épaisseur du cadre
const BOX = 48.5 * S; // cadre, épaisseur comprise
const DIAG = 26 * Math.SQRT2 * S; // longueur d'une diagonale
const CENTER = BOX / 2;

type Props = {
  // Vrai quand l'app est prête (polices, base de données, connexion) :
  // l'animation ne s'efface qu'après.
  ready: boolean;
  // Vrai quand la police Satoshi est chargée (sinon police du téléphone pour le nom).
  fontsLoaded: boolean;
  onDone: () => void;
};

export default function StartupAnimation({ ready, fontsLoaded, onDone }: Props) {
  const [progress] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(1));
  const [drawn, setDrawn] = useState(false);

  // Dessin du logo, une seule fois.
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          progress.setValue(1);
          setDrawn(true);
          return;
        }
        Animated.timing(progress, {
          toValue: 1,
          duration: DRAW_MS,
          easing: Easing.linear,
          // Largeurs et hauteurs animées : pas de pilote natif.
          useNativeDriver: false,
        }).start(() => {
          if (!cancelled) setTimeout(() => setDrawn(true), HOLD_MS);
        });
      });
    return () => {
      cancelled = true;
    };
  }, [progress]);

  // Logo dessiné et app prête : fondu de sortie.
  useEffect(() => {
    if (!drawn || !ready) return;
    const animation = Animated.timing(fade, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(() => onDone());
    return () => animation.stop();
  }, [drawn, ready, fade, onDone]);

  // Une étape entre deux instants du dessin (fractions de 0 à 1), avec freinage final.
  const step = (start: number, end: number, to: number) =>
    progress.interpolate({
      inputRange: [0, start, end, 1],
      outputRange: [0, 0, to, to],
      easing: Easing.out(Easing.cubic),
      extrapolate: 'clamp',
    });

  const wordOpacity = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0, 0, 1] });
  const wordShift = progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [8, 8, 0] });

  return (
    <Animated.View
      style={[styles.overlay, { opacity: fade }]}
      pointerEvents={drawn && ready ? 'none' : 'auto'}
      accessible
      accessibilityLabel="X-Gallery"
    >
      <View style={styles.logo}>
        {/* Cadre : chaque bord grandit depuis le coin où le précédent s'arrête. */}
        <Animated.View style={[styles.edge, { top: 0, left: 0, height: EDGE, width: step(0, 0.1, BOX) }]} />
        <Animated.View style={[styles.edge, { top: 0, right: 0, width: EDGE, height: step(0.1, 0.2, BOX) }]} />
        <Animated.View style={[styles.edge, { bottom: 0, right: 0, height: EDGE, width: step(0.2, 0.3, BOX) }]} />
        <Animated.View style={[styles.edge, { bottom: 0, left: 0, width: EDGE, height: step(0.3, 0.4, BOX) }]} />
        {/* Diagonales : un rail tourné, dans lequel le trait grandit depuis son extrémité. */}
        <Diagonal thickness={7 * S} angle="45deg" length={step(0.42, 0.56, DIAG)} />
        <Diagonal thickness={2.2 * S} angle="135deg" length={step(0.56, 0.68, DIAG)} />
      </View>
      <Animated.Text
        style={[
          styles.word,
          fontsLoaded ? { fontFamily: fonts.medium } : null,
          { opacity: wordOpacity, transform: [{ translateY: wordShift }] },
        ]}
      >
        X-GALLERY
      </Animated.Text>
    </Animated.View>
  );
}

// Diagonale du X : un rail de la longueur complète, tourné autour du centre du logo ;
// le trait grandit à partir du début du rail (en haut à gauche pour 45°, en haut à droite pour 135°).
function Diagonal({
  thickness,
  angle,
  length,
}: {
  thickness: number;
  angle: string;
  length: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: CENTER - DIAG / 2,
        top: CENTER - thickness / 2,
        width: DIAG,
        height: thickness,
        transform: [{ rotate: angle }],
      }}
    >
      <Animated.View style={{ height: thickness, width: length, backgroundColor: colors.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: BOX,
    height: BOX,
  },
  edge: {
    position: 'absolute',
    backgroundColor: colors.accent,
  },
  word: {
    marginTop: 26,
    fontSize: 22,
    letterSpacing: 6,
    color: colors.textPrimary,
  },
});
