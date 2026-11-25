import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/theme';

// Barre d'onglets « magazine » (DESIGN.md) : libellés en capitales, sans icônes,
// filet fin gris très foncé en haut.

// Hauteur utile de la barre (hors zone sûre du bas) : zone tactile ≥ 48 px.
const BAR_HEIGHT = 56;

// Libellé d'onglet : Medium et texte principal si l'onglet est ouvert, sinon Regular et gris.
function tabLabel(text: string) {
  function TabLabel({ focused }: { focused: boolean }) {
    return (
      <Text
        style={{
          fontFamily: focused ? fonts.medium : fonts.regular,
          fontSize: 11,
          letterSpacing: 2,
          color: focused ? colors.textPrimary : colors.textSecondary,
        }}
      >
        {text}
      </Text>
    );
  }
  return TabLabel;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.textPrimary,
          elevation: 0,
          height: BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarItemStyle: { minHeight: 48, justifyContent: 'center' },
        // Aucune icône : seul le libellé en capitales reste.
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Collection', tabBarLabel: tabLabel('COLLECTION') }}
      />
      <Tabs.Screen
        name="galerie"
        options={{ title: 'Galerie vivante', tabBarLabel: tabLabel('GALERIE VIVANTE') }}
      />
    </Tabs>
  );
}
