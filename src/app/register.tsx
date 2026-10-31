import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors, fonts, spacing, radius } from '@/theme';
import { registerUser } from '@/auth/auth';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit =
    username.trim().length > 0 &&
    password.length >= 4 &&
    password === confirmPassword &&
    !saving;

  async function handleRegister() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await registerUser(username, password);
      router.replace('/');
    } catch (error) {
      console.error('Erreur de création du compte', error);
      Alert.alert('Erreur', 'Impossible de créer le compte.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} focusable={false}>
        <Text style={styles.title}>Créer votre compte</Text>
        <Text style={styles.hint}>
          Votre compte est stocké uniquement sur votre téléphone. Aucune donnée
          n’est envoyée sur Internet.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nom d’utilisateur</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Ex. amatriceArt"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Mot de passe (4 caractères minimum)</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
          />
        </View>

        {password !== confirmPassword && confirmPassword.length > 0 ? (
          <Text style={styles.errorText}>
            Les deux mots de passe ne correspondent pas.
          </Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.buttonPressed,
          ]}
          onPress={handleRegister}
          disabled={!canSubmit}
        >
          <Text style={styles.submitText}>
            {saving ? 'Création…' : 'Créer le compte'}
          </Text>
        </Pressable>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    paddingBottom: 180,
  },
  title: {
    fontFamily: fonts.titleBold,
    fontSize: 26,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
  },
  errorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  submitButton: {
    backgroundColor: colors.accent,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onAccent,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

