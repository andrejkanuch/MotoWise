import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function GarageScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('garage.title')}</Text>
      <Pressable style={styles.button} onPress={() => router.push('/(garage)/add-bike')}>
        <Text style={styles.buttonText}>{t('garage.addBike')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  button: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
