import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Détail de l’œuvre</Text>
      <Text style={styles.hint}>Référence : {id}</Text>
      <Text style={styles.subtitle}>
        Les informations complètes de l’œuvre apparaîtront ici.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontFamily: fonts.titleBold,
    fontSize: 28,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  hint: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.accent,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
});
