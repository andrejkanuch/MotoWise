import { colors } from '@motolearn/design-system';
import { CreateMotorcycleDocument } from '@motolearn/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

export default function AddBikeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [year, setYear] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [nickname, setNickname] = useState('');

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (input: { year: number; make: string; model: string; nickname?: string }) =>
      gqlFetcher(CreateMotorcycleDocument, { input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const isValid = year.length === 4 && make.trim().length > 0 && model.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || isPending) return;

    try {
      await mutateAsync({
        year: Number.parseInt(year, 10),
        make: make.trim(),
        model: model.trim(),
        nickname: nickname.trim() || undefined,
      });
      router.back();
    } catch (e) {
      Alert.alert(t('common.error'), String(e));
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="p-6"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-sm font-medium text-neutral-500 mb-1 ml-1">{t('garage.year')}</Text>
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('garage.yearPlaceholder')}
        placeholderTextColor={colors.neutral[400]}
        value={year}
        onChangeText={(text) => setYear(text.replace(/[^0-9]/g, '').slice(0, 4))}
        keyboardType="numeric"
        maxLength={4}
        returnKeyType="next"
      />

      <Text className="text-sm font-medium text-neutral-500 mb-1 ml-1">{t('garage.make')}</Text>
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('garage.makePlaceholder')}
        placeholderTextColor={colors.neutral[400]}
        value={make}
        onChangeText={setMake}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Text className="text-sm font-medium text-neutral-500 mb-1 ml-1">{t('garage.model')}</Text>
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('garage.modelPlaceholder')}
        placeholderTextColor={colors.neutral[400]}
        value={model}
        onChangeText={setModel}
        autoCapitalize="words"
        returnKeyType="next"
      />

      <Text className="text-sm font-medium text-neutral-500 mb-1 ml-1">{t('garage.nickname')}</Text>
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('garage.nickname')}
        placeholderTextColor={colors.neutral[400]}
        value={nickname}
        onChangeText={setNickname}
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />

      <Pressable
        className={`rounded-xl p-4 items-center mt-2 ${
          isValid && !isPending
            ? 'bg-primary-950 dark:bg-primary-500'
            : 'bg-neutral-300 dark:bg-neutral-700'
        }`}
        style={{ borderCurve: 'continuous' }}
        onPress={handleSubmit}
        disabled={!isValid || isPending}
      >
        {isPending ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator size="small" color="white" />
            <Text className="text-white text-base font-semibold">{t('garage.saving')}</Text>
          </View>
        ) : (
          <Text className="text-white text-base font-semibold">{t('garage.addBike')}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
