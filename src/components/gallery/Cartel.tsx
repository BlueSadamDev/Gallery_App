import { StyleSheet, Text, View } from 'react-native';
import { fonts } from '@/theme';
import { formatDisplayText } from '@/utils/text';

const TEXT_PRIMARY = '#1C1B19';
const TEXT_SECONDARY = '#7A756B';

type Props = {
  title: string;
  artist: string;
  year: string;
};

// Cartel de musée sous l'œuvre : titre, puis « artiste, année ».
export default function Cartel({ title, artist, year }: Props) {
  const artistName = artist.trim() === '' ? 'Artiste inconnu' : artist.trim();
  const caption = year.trim() ? `${artistName}, ${year.trim()}` : artistName;

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={3}>
        {formatDisplayText(title)}
      </Text>
      <Text style={styles.caption} numberOfLines={2}>
        {formatDisplayText(caption)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    alignItems: 'center',
    maxWidth: 280,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 20,
    lineHeight: 26,
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  caption: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: 4,
  },
});
