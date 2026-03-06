import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function ArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Article: {slug}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  text: { fontSize: 18 },
});
