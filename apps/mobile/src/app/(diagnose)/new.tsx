import { StyleSheet, Text, View } from 'react-native';

export default function NewDiagnosticScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Diagnostic Wizard</Text>
      <Text style={styles.subtitle}>Take a photo or describe the issue</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  text: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666' },
});
