import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export default function LearnScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 justify-center items-center bg-white dark:bg-neutral-900">
      <Text className="text-base text-neutral-500 dark:text-neutral-400">{t('learn.explore')}</Text>
    </View>
  );
}
