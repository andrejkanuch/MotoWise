import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export default function NewDiagnosticScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('diagnose.wizardTitle')}</Text>
      <Text style={styles.subtitle}>{t('diagnose.wizardSubtitle')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  text: { fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666' },
});
