import { StyleSheet, Text, View } from 'react-native';

export default function LearnScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Explore motorcycle topics</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 16, color: '#666' },
});
