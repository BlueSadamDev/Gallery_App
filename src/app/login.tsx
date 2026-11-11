import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors, fonts, spacing, radius } from '@/theme';
import { loginUser } from '@/auth/auth';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !saving;

  async function handleLogin() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const ok = await loginUser(username, password);
      if (ok) {
        router.replace('/');
      } else {
        Alert.alert('Connexion refusée', 'Nom d’utilisateur ou mot de passe incorrect.');
        setSaving(false);
      }
    } catch (error) {
      console.error('Erreur de connexion', error);
      Alert.alert('Erreur', 'Impossible de se connecter.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View>
        <Text style={styles.title}>Bienvenue</Text>
        <Text style={styles.hint}>
          Connectez-vous pour accéder à votre collection.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Nom d’utilisateur</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Votre nom d’utilisateur"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Votre mot de passe"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.buttonPressed,
          ]}
          onPress={handleLogin}
          disabled={!canSubmit}
        >
          <Text style={styles.submitText}>
            {saving ? 'Connexion…' : 'Se connecter'}
          </Text>
        </Pressable>
        </View>
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
