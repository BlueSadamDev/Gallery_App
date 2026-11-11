import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/theme';

// Couleurs de la charte DESIGN.md pour la barre d'onglets.
const BACKGROUND = '#F6F2EA';
const HAIRLINE = '#E3DDD1';
const ACCENT = '#7B3F3A';
const ICON_GRAY = '#7A756B';

// Hauteur utile de la barre (hors zone sûre du bas) : zone tactile ≥ 48 px.
const BAR_HEIGHT = 56;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: ICON_GRAY,
        tabBarStyle: {
          backgroundColor: BACKGROUND,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: HAIRLINE,
          elevation: 0,
          height: BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarItemStyle: { minHeight: 48 },
        tabBarLabelStyle: { fontFamily: fonts.regular, fontSize: 12 },
        sceneStyle: { backgroundColor: BACKGROUND },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Collection',
          tabBarIcon: ({ focused }) => (
            <Feather name="grid" size={20} color={focused ? ACCENT : ICON_GRAY} />
          ),
        }}
      />
      <Tabs.Screen
        name="galerie"
        options={{
          title: 'Galerie vivante',
          tabBarIcon: ({ focused }) => (
            <Feather name="sun" size={20} color={focused ? ACCENT : ICON_GRAY} />
          ),
        }}
      />
    </Tabs>
  );
}
