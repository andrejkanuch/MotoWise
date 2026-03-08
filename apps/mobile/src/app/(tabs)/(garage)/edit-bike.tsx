import { palette } from '@motolearn/design-system';
import { MyMotorcyclesDocument, UpdateMotorcycleDocument } from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function EditBikeScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const bike = (data?.myMotorcycles ?? []).find((m: { id: string }) => m.id === id);

  const [nickname, setNickname] = useState('');
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (bike && !initialized) {
      setNickname(bike.nickname ?? '');
      setYear(String(bike.year));
      setMake(bike.make);
      setModel(bike.model);
      setIsPrimary(bike.isPrimary);
      setInitialized(true);
    }
  }, [bike, initialized]);

  const updateMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(UpdateMotorcycleDocument, {
        id,
        input: {
          nickname: nickname.trim() || null,
          year: Number.parseInt(year, 10),
          make: make.trim(),
          model: model.trim(),
          isPrimary,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        router.back();
      }, 1000);
    },
  });

  const inputStyle = {
    backgroundColor: isDark ? palette.neutral800 : palette.white,
    borderRadius: 14,
    borderCurve: 'continuous' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: isDark ? palette.neutral50 : palette.neutral950,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: '600' as const,
    color: palette.neutral500,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}
      behavior="padding"
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={FadeInUp.duration(400)} style={{ gap: 20 }}>
          <View>
            <Text style={labelStyle}>{t('garage.nickname', { defaultValue: 'Nickname' })}</Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('garage.nicknamePlaceholder', { defaultValue: 'e.g. "Black Beauty"' })}
              placeholderTextColor={palette.neutral400}
              style={inputStyle}
            />
          </View>

          <View>
            <Text style={labelStyle}>{t('garage.year', { defaultValue: 'Year' })}</Text>
            <TextInput
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              placeholder="2024"
              placeholderTextColor={palette.neutral400}
              style={inputStyle}
            />
          </View>

          <View>
            <Text style={labelStyle}>{t('garage.make', { defaultValue: 'Make' })}</Text>
            <TextInput
              value={make}
              onChangeText={setMake}
              placeholder="Honda"
              placeholderTextColor={palette.neutral400}
              autoCapitalize="words"
              style={inputStyle}
            />
          </View>

          <View>
            <Text style={labelStyle}>{t('garage.model', { defaultValue: 'Model' })}</Text>
            <TextInput
              value={model}
              onChangeText={setModel}
              placeholder="CB650R"
              placeholderTextColor={palette.neutral400}
              autoCapitalize="words"
              style={inputStyle}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 14,
              borderCurve: 'continuous',
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                color: isDark ? palette.neutral50 : palette.neutral950,
              }}
            >
              {t('garage.setPrimary', { defaultValue: 'Set as Primary' })}
            </Text>
            <Switch
              value={isPrimary}
              onValueChange={(v) => {
                haptic();
                setIsPrimary(v);
              }}
              trackColor={{ false: palette.neutral300, true: palette.primary500 }}
              thumbColor={palette.white}
            />
          </View>
        </Animated.View>

        {/* Save */}
        <Animated.View entering={FadeInUp.delay(80).duration(400)} style={{ marginTop: 32 }}>
          <Pressable
            onPress={() => {
              haptic();
              updateMutation.mutate();
            }}
            disabled={updateMutation.isPending || !make.trim() || !model.trim()}
            style={{
              borderRadius: 16,
              borderCurve: 'continuous',
              overflow: 'hidden',
              opacity: !make.trim() || !model.trim() ? 0.5 : 1,
            }}
          >
            <LinearGradient
              colors={
                saved
                  ? [palette.success500, palette.success600]
                  : [palette.primary600, palette.primary500]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 16,
                gap: 8,
              }}
            >
              {saved && <Check size={18} color={palette.white} strokeWidth={2.5} />}
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
                {saved
                  ? t('settings.saved', { defaultValue: 'Saved!' })
                  : updateMutation.isPending
                    ? t('settings.saving', { defaultValue: 'Saving...' })
                    : t('settings.save', { defaultValue: 'Save Changes' })}
              </Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
