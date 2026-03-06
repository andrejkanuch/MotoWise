import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function AddBikeScreen() {
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add a Bike</Text>
      <TextInput
        style={styles.input}
        placeholder="Make (e.g. Honda)"
        value={make}
        onChangeText={setMake}
      />
      <TextInput
        style={styles.input}
        placeholder="Model (e.g. CB500F)"
        value={model}
        onChangeText={setModel}
      />
      <TextInput
        style={styles.input}
        placeholder="Year"
        value={year}
        onChangeText={setYear}
        keyboardType="numeric"
      />
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>Add Bike</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  button: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
