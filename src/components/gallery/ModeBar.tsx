import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/theme';
import { GalleryMode } from '@/utils/ambiance';

const TEXT_PRIMARY = '#1C1B19';
const TEXT_SECONDARY = '#7A756B';
const ACCENT = '#7B3F3A';

const MODES: { value: GalleryMode; label: string }[] = [
  { value: 'AUTO', label: 'Auto' },
  { value: 'TIME_TRAVEL', label: 'Time-Travel' },
  { value: 'PURIST', label: 'Puriste' },
];

type Props = {
  mode: GalleryMode;
  onChange: (mode: GalleryMode) => void;
};

// Contrôle segmenté sobre : trois mots, le mode actif est souligné en accent.
export default function ModeBar({ mode, onChange }: Props) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {MODES.map((item) => {
        const active = item.value === mode;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.item}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  item: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    letterSpacing: 0.5,
    color: TEXT_SECONDARY,
  },
  labelActive: {
    fontFamily: fonts.medium,
    color: TEXT_PRIMARY,
  },
  underline: {
    marginTop: 6,
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: 'transparent',
  },
  underlineActive: {
    backgroundColor: ACCENT,
  },
});
