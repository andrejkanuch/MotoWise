import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function AddBikeScreen() {
  const { t } = useTranslation();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('garage.addBikeTitle')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('garage.makePlaceholder')}
        value={make}
        onChangeText={setMake}
      />
      <TextInput
        style={styles.input}
        placeholder={t('garage.modelPlaceholder')}
        value={model}
        onChangeText={setModel}
      />
      <TextInput
        style={styles.input}
        placeholder={t('garage.yearPlaceholder')}
        value={year}
        onChangeText={setYear}
        keyboardType="numeric"
      />
      <Pressable style={styles.button}>
        <Text style={styles.buttonText}>{t('garage.addBike')}</Text>
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
