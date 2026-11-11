// Éléments d'interface communs au parcours d'ajout d'une œuvre.
// Couleurs, coins et tailles repris de DESIGN.md (comme l'écran d'accueil).

import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts } from '@/theme';

export const palette = {
  background: '#F6F2EA',
  text: '#1C1B19',
  textSecondary: '#7A756B',
  hairline: '#E3DDD1',
  field: '#CFC8BA',
  accent: '#7B3F3A',
  onAccent: '#F6F2EA',
  label: '#8A6A45',
  placeholder: '#E3DDD1',
} as const;

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

// Bouton plein, couleur accent (un seul par écran).
export function PrimaryButton({ label, onPress, disabled, loading }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        styles.primary,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.onAccent} /> : null}
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

// Bouton à contour fin.
export function SecondaryButton({ label, onPress, disabled, loading }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        styles.secondary,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.accent} /> : null}
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

// Lien texte discret (zone tactile de 48 px).
export function LinkButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.link, (disabled || pressed) && styles.disabled]}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  hint?: string; // mention discrète à droite du libellé (ex. « À vérifier »)
};

// Champ de saisie souligné d'un trait fin.
export function Field({ label, value, onChangeText, placeholder, multiline, hint }: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      </View>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

// Petite étiquette au-dessus d'un titre d'écran.
export function Eyebrow({ children }: { children: string }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function ScreenTitle({ children }: { children: string }) {
  return <Text style={styles.title}>{children}</Text>;
}

// Message d'information ou d'erreur, sobre.
export function Notice({ children }: { children: string }) {
  return <Text style={styles.notice}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 2,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: palette.accent,
  },
  primaryText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: palette.onAccent,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.accent,
  },
  secondaryText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: palette.accent,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  link: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: palette.accent,
  },
  field: {
    marginBottom: 24,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  fieldLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    letterSpacing: 0.6,
    color: palette.label,
  },
  fieldHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: palette.textSecondary,
  },
  input: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.field,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: palette.text,
    paddingVertical: 8,
  },
  inputMultiline: {
    minHeight: 96,
  },
  eyebrow: {
    fontFamily: fonts.regular,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: palette.label,
    marginBottom: 8,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 32,
    color: palette.text,
    marginBottom: 24,
  },
  notice: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: palette.textSecondary,
    marginBottom: 16,
  },
});
