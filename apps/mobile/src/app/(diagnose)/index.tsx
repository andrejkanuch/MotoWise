import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function DiagnoseScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={() => router.push('/(diagnose)/new')}>
        <Text style={styles.buttonText}>Start New Diagnosis</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
