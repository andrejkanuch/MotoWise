import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Link } from 'expo-router';

const logo = require('../../assets/images/MotoWise.png');
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { signInWithApple, signInWithGoogle } from '../../lib/oauth';
import { supabase } from '../../lib/supabase';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) {
        Alert.alert(t('common.error'), error.message);
      } else if (data.user && !data.session) {
        Alert.alert(t('auth.checkEmail'), t('auth.confirmationSent'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      await signInWithApple();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const handleGoogleSignIn = async () => {
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      await signInWithGoogle();
    } catch (err) {
      Alert.alert(t('common.error'), (err as Error).message);
    }
  };

  const canSubmit = email.length > 0 && password.length > 0 && fullName.length > 0 && !loading;

  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 48,
            gap: 32,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeInDown.duration(600)} style={{ alignItems: 'center', gap: 12 }}>
            <Image
              source={logo}
              style={{
                width: 88,
                height: 88,
                borderRadius: 22,
                borderCurve: 'continuous',
                marginBottom: 8,
              }}
            />
            <Text
              style={{
                fontSize: 28,
                fontWeight: '800',
                color: '#FFFFFF',
                letterSpacing: -0.5,
                textAlign: 'center',
              }}
            >
              {t('auth.signUp')}
            </Text>
          </Animated.View>

          {/* Social auth */}
          <Animated.View entering={FadeInUp.delay(150).duration(500)} style={{ gap: 12 }}>
            {process.env.EXPO_OS === 'ios' && (
              <Pressable
                onPress={handleAppleSignIn}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  paddingVertical: 16,
                  gap: 10,
                  opacity: pressed ? 0.85 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#000000' }}>
                  {t('auth.continueWithApple')}
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleGoogleSignIn}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderRadius: 16,
                borderCurve: 'continuous',
                paddingVertical: 16,
                gap: 10,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#FFFFFF' }}>G</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }}>
                {t('auth.continueWithGoogle')}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Divider */}
          <Animated.View
            entering={FadeIn.delay(300).duration(400)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}
          >
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
            <Text style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.35)', fontWeight: '500' }}>
              {t('auth.orContinueWithEmail')}
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.08)' }} />
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.delay(350).duration(500)} style={{ gap: 14 }}>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('auth.fullName')}
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              autoComplete="name"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 18,
                paddingVertical: 16,
                fontSize: 16,
                color: '#FFFFFF',
              }}
            />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.email')}
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 18,
                paddingVertical: 16,
                fontSize: 16,
                color: '#FFFFFF',
              }}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              secureTextEntry
              autoComplete="new-password"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingHorizontal: 18,
                paddingVertical: 16,
                fontSize: 16,
                color: '#FFFFFF',
              }}
            />
            <Pressable
              onPress={handleRegister}
              disabled={!canSubmit}
              style={({ pressed }) => ({
                backgroundColor: canSubmit ? '#FFFFFF' : 'rgba(255, 255, 255, 0.12)',
                borderRadius: 14,
                borderCurve: 'continuous',
                paddingVertical: 18,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              {loading && <ActivityIndicator size="small" color="#0F172A" />}
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '700',
                  color: canSubmit ? '#0F172A' : 'rgba(255, 255, 255, 0.3)',
                }}
              >
                {loading ? t('auth.signingUp') : t('auth.signUp')}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Footer */}
          <Animated.View entering={FadeIn.delay(500).duration(400)} style={{ alignItems: 'center' }}>
            <Link href="/(auth)/login" asChild>
              <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 8 })}>
                <Text style={{ fontSize: 15, color: '#60A5FA', fontWeight: '600' }}>
                  {t('auth.hasAccount')}
                </Text>
              </Pressable>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
