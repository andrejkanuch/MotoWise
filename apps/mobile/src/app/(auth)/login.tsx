import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  };

  return (
    <View className="flex-1 justify-center p-6 bg-white dark:bg-neutral-900">
      <Text className="text-3xl font-bold text-center mb-2 text-neutral-950 dark:text-neutral-50">
        {t('common.appName')}
      </Text>
      <Text className="text-base text-center mb-8 text-neutral-500 dark:text-neutral-400">
        {t('auth.tagline')}
      </Text>
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('auth.email')}
        placeholderTextColor="#999"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('auth.password')}
        placeholderTextColor="#999"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable
        className="bg-primary-950 dark:bg-primary-500 rounded-xl p-4 items-center mb-4"
        style={{ borderCurve: 'continuous' }}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">
          {loading ? t('auth.signingIn') : t('auth.signIn')}
        </Text>
      </Pressable>
      <Link href="/(auth)/register" className="text-center text-primary-950 dark:text-primary-400">
        <Text>{t('auth.noAccount')}</Text>
      </Link>
    </View>
  );
}
