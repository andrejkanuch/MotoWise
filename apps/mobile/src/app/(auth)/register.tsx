import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '../../lib/supabase';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) Alert.alert('Error', error.message);
    setLoading(false);
  };

  return (
    <View className="flex-1 justify-center p-6 bg-white dark:bg-neutral-900">
      <Text className="text-2xl font-bold text-center mb-8 text-neutral-950 dark:text-neutral-50">
        {t('auth.signUp')}
      </Text>
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('auth.fullName')}
        placeholderTextColor="oklch(0.71 0 0)"
        value={fullName}
        onChangeText={setFullName}
      />
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('auth.email')}
        placeholderTextColor="oklch(0.71 0 0)"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('auth.password')}
        placeholderTextColor="oklch(0.71 0 0)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Pressable
        className="bg-primary-950 dark:bg-primary-500 rounded-xl p-4 items-center mb-4"
        style={{ borderCurve: 'continuous' }}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text className="text-white text-base font-semibold">
          {loading ? t('auth.signingUp') : t('auth.signUp')}
        </Text>
      </Pressable>
      <Link href="/(auth)/login" className="text-center text-primary-950 dark:text-primary-400">
        <Text>{t('auth.hasAccount')}</Text>
      </Link>
    </View>
  );
}
