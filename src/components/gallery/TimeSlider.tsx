import Slider from '@react-native-community/slider';
import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/theme';
import { formatHourLabel } from '@/utils/ambiance';

const TEXT_PRIMARY = '#1C1B19';
const ACCENT = '#7B3F3A';
const FIELD_LINE = '#CFC8BA';

type Props = {
  minutes: number; // 0 à 1440
  onChange: (minutes: number) => void;
};

// Curseur Time-Travel : simule une heure entre 0 h et 24 h (pas de 15 min).
export default function TimeSlider({ minutes, onChange }: Props) {
  return (
    <View style={styles.row}>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1440}
        step={15}
        value={minutes}
        onValueChange={onChange}
        minimumTrackTintColor={ACCENT}
        maximumTrackTintColor={FIELD_LINE}
        thumbTintColor={ACCENT}
        accessibilityLabel="Heure simulée"
      />
      <Text style={styles.label}>{formatHourLabel(minutes)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  slider: {
    flex: 1,
    height: 48,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: TEXT_PRIMARY,
    minWidth: 64,
    textAlign: 'right',
  },
});
