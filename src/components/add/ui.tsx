// Éléments d'interface communs au parcours d'ajout et à la modification d'une œuvre.
// Style « magazine » de DESIGN.md : rubriques à filet, étiquettes en capitales espacées,
// champs soulignés, bouton principal gris très foncé. L'accent (bordeaux) est réservé
// au bouton « + » et aux numéros.

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts } from '@/theme';
import { magazine } from '@/components/magazine/styles';

export const palette = {
  background: '#F6F2EA',
  // Mêmes couleurs de texte que le thème central (src/theme).
  text: '#2B2926',
  textSecondary: '#6B665C',
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

// Bouton principal plein (un seul par écran) : gris très foncé, texte crème en capitales,
// pleine largeur, 52 px de haut.
export function PrimaryButton({ label, onPress, disabled, loading }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
      <Text style={styles.primaryText}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

// Bouton à contour fin (texte principal).
export function SecondaryButton({ label, onPress, disabled, loading }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        styles.secondary,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.text} /> : null}
      <Text style={styles.secondaryText}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

// Lien souligné (texte principal, zone tactile de 48 px).
export function LinkButton({
  label,
  onPress,
  disabled,
  align = 'center',
}: ButtonProps & { align?: 'center' | 'left' }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.link,
        align === 'left' && styles.linkLeft,
        (disabled || pressed) && styles.disabled,
      ]}
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

// Champ souligné, nom en capitales 11 px au-dessus.
export function Field({ label, value, onChangeText, placeholder, multiline, hint }: FieldProps) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
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
        accessibilityLabel={label}
      />
    </View>
  );
}

// Grand titre de page (Medium 40 px).
export function ScreenTitle({ children }: { children: string }) {
  return <Text style={magazine.pageTitle}>{children}</Text>;
}

// Phrase d'introduction sous le titre (15 px, texte secondaire).
export function Intro({ children }: { children: string }) {
  return <Text style={styles.intro}>{children}</Text>;
}

// Rubrique : filet de 2 px, étiquette en capitales à gauche, mention facultative à droite.
export function Rubric({
  label,
  right,
  children,
}: {
  label: string;
  right?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.rubric}>
      <View style={magazine.kickerRow}>
        <Text style={magazine.sectionLabel}>{label}</Text>
        {right ? <Text style={magazine.kicker}>{right}</Text> : null}
      </View>
      <View style={styles.rubricBody}>{children}</View>
    </View>
  );
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
    height: 52,
    alignSelf: 'stretch',
    backgroundColor: palette.text,
  },
  primaryText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    letterSpacing: 2.4,
    color: palette.onAccent,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.text,
  },
  secondaryText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 2,
    color: palette.text,
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
  linkLeft: {
    alignItems: 'flex-start',
  },
  linkText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: palette.text,
    textDecorationLine: 'underline',
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
    fontSize: 11,
    letterSpacing: 2.4,
    color: palette.textSecondary,
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
  intro: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: palette.textSecondary,
    marginTop: 12,
  },
  rubric: {
    marginTop: 32,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: palette.text,
  },
  rubricBody: {
    marginTop: 16,
  },
  notice: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: palette.textSecondary,
    marginBottom: 16,
  },
});
