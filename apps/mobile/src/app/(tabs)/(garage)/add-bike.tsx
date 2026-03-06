import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';

export default function AddBikeScreen() {
  const { t } = useTranslation();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');

  return (
    <View className="flex-1 p-6 bg-white dark:bg-neutral-900">
      <Text className="text-2xl font-bold mb-6 text-neutral-950 dark:text-neutral-50">
        {t('garage.addBikeTitle')}
      </Text>
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('garage.makePlaceholder')}
        placeholderTextColor="#999"
        value={make}
        onChangeText={setMake}
      />
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('garage.modelPlaceholder')}
        placeholderTextColor="#999"
        value={model}
        onChangeText={setModel}
      />
      <TextInput
        className="border border-neutral-300 dark:border-neutral-700 rounded-xl p-4 mb-4 text-base text-neutral-950 dark:text-neutral-50 bg-white dark:bg-neutral-800"
        style={{ borderCurve: 'continuous' }}
        placeholder={t('garage.yearPlaceholder')}
        placeholderTextColor="#999"
        value={year}
        onChangeText={setYear}
        keyboardType="numeric"
      />
      <Pressable
        className="bg-primary-950 dark:bg-primary-500 rounded-xl p-4 items-center"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className="text-white text-base font-semibold">{t('garage.addBike')}</Text>
      </Pressable>
    </View>
  );
}
