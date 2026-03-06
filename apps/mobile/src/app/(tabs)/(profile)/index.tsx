import type { SupportedLocale } from '@motolearn/types';
import { SUPPORTED_LOCALES } from '@motolearn/types';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../../stores/auth.store';
import { supabase } from '../../../lib/supabase';

const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  es: 'Espanol',
  de: 'Deutsch',
};

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { locale, setLocale } = useAuthStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.title')}</Text>
      <Text style={styles.sectionTitle}>{t('profile.language')}</Text>
      <Text style={styles.description}>{t('profile.languageDescription')}</Text>
      <View style={styles.localeRow}>
        {SUPPORTED_LOCALES.map((loc) => (
          <Pressable
            key={loc}
            style={[styles.localeButton, locale === loc && styles.localeButtonActive]}
            onPress={() => setLocale(loc)}
          >
            <Text style={[styles.localeText, locale === loc && styles.localeTextActive]}>
              {LOCALE_DISPLAY_NAMES[loc]}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>{t('auth.signOut')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
  description: { fontSize: 14, color: '#666', marginBottom: 16 },
  localeRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  localeButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  localeButtonActive: {
    backgroundColor: '#007AFF',
  },
  localeText: { fontSize: 16, fontWeight: '600', color: '#333' },
  localeTextActive: { color: '#fff' },
  button: { backgroundColor: '#e74c3c', borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
