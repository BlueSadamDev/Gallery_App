import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { ActivityIndicator, View } from 'react-native';
import { useEffect, useState } from 'react';
import { colors } from '@/theme';
import { initDatabase } from '@/db/database';
import { isLoggedIn, isUserRegistered } from '@/auth/auth';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.ttf'),
  });
  const [dbReady, setDbReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((error) => {
        console.error('Erreur d’initialisation de la base de données', error);
        // On laisse l'app démarrer même en cas d'erreur de base.
        setDbReady(true);
      });
  }, []);

  // Vérifie l'état de connexion et redirige si nécessaire.
  useEffect(() => {
    if (!dbReady) return;
    (async () => {
      const loggedIn = await isLoggedIn();
      if (loggedIn) {
        setAuthChecked(true);
        return;
      }
      const registered = await isUserRegistered();
      if (registered) {
        router.replace('/login');
      } else {
        router.replace('/register');
      }
      setAuthChecked(true);
    })();
  }, [dbReady]);

  if (!fontsLoaded || !dbReady || !authChecked) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        {/* Groupe des onglets (Collection, Galerie vivante) : sans en-tête. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}




