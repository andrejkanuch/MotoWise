import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export default function DiagnosticResultScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View className="flex-1 p-4 bg-white dark:bg-neutral-900">
      <Text className="text-lg text-neutral-950 dark:text-neutral-50">
        {t('diagnose.resultPrefix', { id })}
      </Text>
    </View>
  );
}
