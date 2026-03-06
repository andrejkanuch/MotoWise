import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { supabase } from '../../lib/supabase';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) Alert.alert(t('common.error'), error.message);
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  return (
    <View className="flex-1 justify-center p-6 bg-white dark:bg-neutral-900">
      {/* Header */}
      <Animated.View entering={FadeInUp.duration(500)}>
        <Text className="text-2xl font-bold text-center mb-8 text-neutral-950 dark:text-neutral-50">
          {t('auth.signUp')}
        </Text>
      </Animated.View>

      {/* Social auth buttons */}
      <Animated.View entering={FadeInUp.duration(500).delay(100)}>
        {process.env.EXPO_OS === 'ios' && (
          <Pressable
            className="flex-row items-center justify-center bg-black rounded-2xl py-4 mb-3"
            style={{ borderCurve: 'continuous' }}
            onPress={handleAppleSignIn}
          >
            <Text className="text-white text-lg mr-2">{'\uF8FF'}</Text>
            <Text className="text-white text-base font-semibold">
              {t('auth.continueWithApple')}
            </Text>
          </Pressable>
        )}

        <Pressable
          className="flex-row items-center justify-center bg-white dark:bg-neutral-100 rounded-2xl py-4 mb-3 border border-neutral-200 dark:border-neutral-300"
          style={{ borderCurve: 'continuous' }}
          onPress={handleGoogleSignIn}
        >
          <Text className="text-neutral-900 text-lg font-bold mr-2">G</Text>
          <Text className="text-neutral-900 text-base font-semibold">
            {t('auth.continueWithGoogle')}
          </Text>
        </Pressable>
      </Animated.View>

      {/* Divider */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(200)}
        className="flex-row items-center my-6"
      >
        <View className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
        <Text className="mx-4 text-sm text-neutral-400 dark:text-neutral-500">
          {t('auth.orContinueWithEmail')}
        </Text>
        <View className="flex-1 h-px bg-neutral-200 dark:bg-neutral-700" />
      </Animated.View>

      {/* Form fields */}
      <Animated.View entering={FadeInUp.duration(500).delay(300)}>
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
      </Animated.View>

      {/* Footer link */}
      <Animated.View entering={FadeInUp.duration(500).delay(400)}>
        <Link href="/(auth)/login" className="text-center text-primary-950 dark:text-primary-400">
          <Text>{t('auth.hasAccount')}</Text>
        </Link>
      </Animated.View>
    </View>
  );
}
