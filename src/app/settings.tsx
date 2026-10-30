import { Picker } from '@react-native-picker/picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, fonts, spacing, radius } from '@/theme';
import {
  getGeminiApiKey,
  getGeminiModel,
  saveGeminiApiKey,
  saveGeminiModel,
  GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
} from '@/config/settings';
import { logoutUser } from '@/auth/auth';
import { exportBackup, importBackup } from '@/utils/backup';
import { testGeminiModel } from '@/utils/gemini';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [model, setModel] = useState<string>(DEFAULT_GEMINI_MODEL);

  // Au chargement, récupère la clé déjà enregistrée (masquée) et le modèle choisi.
  useEffect(() => {
    getGeminiApiKey().then((key) => {
      if (key) {
        setApiKey(key);
        setHasSavedKey(true);
      }
    });
    getGeminiModel().then((saved) => setModel(saved));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await saveGeminiApiKey(apiKey);
      await saveGeminiModel(model);
      const key = apiKey.trim();
      if (key.length > 0) {
        setHasSavedKey(true);
        Alert.alert('Enregistré', 'Votre clé API Gemini a été enregistrée.');
      } else {
        setHasSavedKey(false);
        Alert.alert('Clé supprimée', 'La clé API a été retirée.');
      }
    } catch (error) {
      console.error('Erreur de sauvegarde de la clé', error);
      Alert.alert('Erreur', 'Impossible d’enregistrer la clé API.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    // On sauvegarde d'abord la clé et le modèle saisis, puis on teste vraiment le modèle.
    const key = apiKey.trim();
    if (key.length === 0) {
      Alert.alert('Clé manquante', 'Saisissez d’abord votre clé API Gemini.');
      return;
    }
    setSaving(true);
    try {
      await saveGeminiApiKey(key);
      await saveGeminiModel(model);
      setHasSavedKey(true);
      const result = await testGeminiModel();
      if (result.endsWith(': OK')) {
        Alert.alert('Test réussi', result);
      } else {
        Alert.alert(
          'Test échoué',
          `${result}\n\nEssayez un autre modèle dans la liste (par exemple Gemini 2.5 Flash ou Gemini 3.1 Flash-Lite).`
        );
      }
    } catch (error) {
      console.error('Erreur de test de la clé', error);
      Alert.alert('Erreur', 'Impossible de joindre Gemini. Vérifiez votre connexion.');
    } finally {
      setSaving(false);
    }
  }

  // Déconnecte l'utilisateur et revient à l'écran de connexion.
  function handleLogout() {
    Alert.alert(
      'Se déconnecter ?',
      'Vous devrez vous reconnecter pour accéder à votre collection.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await logoutUser();
            router.replace('/login');
          },
        },
      ]
    );
  }

  // Exporte la collection vers un fichier partageable.
  async function handleExport() {
    try {
      const ok = await exportBackup();
      if (!ok) {
        Alert.alert('Export', 'Impossible de partager la sauvegarde sur cet appareil.');
      }
    } catch (error) {
      console.error('Erreur d’export', error);
      Alert.alert('Erreur', 'Impossible d’exporter la sauvegarde.');
    }
  }

  // Importe une sauvegarde depuis un fichier.
  async function handleImport() {
    try {
      const count = await importBackup();
      if (count > 0) {
        Alert.alert(
          'Import terminé',
          `${count} œuvre(s) ont été restaurée(s).`
        );
      } else {
        Alert.alert('Import annulé', 'Aucune œuvre importée.');
      }
    } catch (error) {
      console.error('Erreur d’import', error);
      Alert.alert(
        'Erreur',
        'Le fichier sélectionné ne semble pas être une sauvegarde valide.'
      );
    }
  }



  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Intelligence artificielle</Text>
        <Text style={styles.sectionHint}>
          Pour identifier automatiquement une œuvre à partir d’une photo,
          saisissez votre clé API Google Gemini.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Clé API Gemini</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="AIzaSy…"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          {hasSavedKey ? (
            <Text style={styles.statusText}>✔ Clé enregistrée</Text>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Modèle Gemini</Text>
          <Text style={styles.fieldHint}>
            Choisissez le modèle autorisé par votre clé. En cas d’échec,
            essayez Gemini 2.5 Flash ou Gemini 3.1 Flash-Lite.
          </Text>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={model}
              onValueChange={(value) => setModel(String(value))}
              dropdownIconColor={colors.textSecondary}
              style={styles.picker}
            >
              {GEMINI_MODELS.map((item) => (
                <Picker.Item
                  key={item.value}
                  label={item.label}
                  value={item.value}
                  color={colors.textPrimary}
                />
              ))}
            </Picker>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Enregistrement…' : 'Enregistrer la clé'}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.testButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleTest}
          disabled={saving}
        >
          <Text style={styles.testButtonText}>Tester la clé</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Sauvegarde et restauration</Text>
        <Text style={styles.sectionHint}>
          Exportez votre collection dans un fichier pour la conserver ailleurs,
          ou importez une sauvegarde précédente.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.backupButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleExport}
        >
          <Text style={styles.backupButtonText}>Exporter la sauvegarde</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.backupButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleImport}
        >
          <Text style={styles.backupButtonText}>Importer une sauvegarde</Text>
        </Pressable>


        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>Se déconnecter</Text>
        </Pressable>


        <Text style={styles.privacyNote}>
          Votre clé est stockée de manière sécurisée sur votre téléphone et
          n’est jamais partagée ni incluse dans les sauvegardes.
        </Text>
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
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sectionTitle: {
    fontFamily: fonts.titleBold,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  fieldGroup: {
    marginBottom: spacing.lg,
  },
  fieldHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
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
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: fonts.regular,
  },
  statusText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.accent,
    marginTop: spacing.sm,
  },
  pickerWrapper: {
    backgroundColor: colors.inputBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 48,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    color: colors.textPrimary,
    minHeight: 48,
  },
  saveButton: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.onAccent,
  },
  testButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  testButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.accent,
  },
  privacyNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.xl,
    textAlign: 'center',
  },

  backupButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 13,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  backupButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.accent,
  },


  logoutButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  logoutButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.danger,
  },

  buttonPressed: {
    opacity: 0.85,
  },
});

