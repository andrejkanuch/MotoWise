import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export default function NewDiagnosticScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 justify-center items-center p-4 bg-white dark:bg-neutral-900">
      <Text className="text-2xl font-bold mb-2 text-neutral-950 dark:text-neutral-50">
        {t('diagnose.wizardTitle')}
      </Text>
      <Text className="text-base text-neutral-500 dark:text-neutral-400">
        {t('diagnose.wizardSubtitle')}
      </Text>
    </View>
  );
}
