import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('notFound.message')}</Text>
      <Link href="/(learn)">
        <Text style={styles.link}>{t('notFound.goToLearn')}</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 20, marginBottom: 16 },
  link: { color: '#1a1a2e', fontSize: 16 },
});
