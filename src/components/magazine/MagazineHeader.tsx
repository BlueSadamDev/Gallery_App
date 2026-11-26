import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/theme';

type Props = {
  // Rubrique affichée au centre, en capitales (« COLLECTION »).
  label: string;
  // Bouton facultatif à droite (par exemple « Modifier »).
  right?: ReactNode;
};

// En-tête des pages intérieures du magazine : retour, rubrique au centre, action à droite.
export default function MagazineHeader({ label, right }: Props) {
  const insets = useSafeAreaInsets();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retour"
          onPress={goBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        {right ?? <View style={styles.iconButton} />}
      </View>
    </View>
  );
}

// Bouton icône de 48 px pour la droite de l'en-tête.
export function HeaderIconButton({
  icon,
  label,
  onPress,
}: {
  icon: 'edit-2';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.textPrimary,
  },
  row: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  iconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 2.4,
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
});
