import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <View className="flex-1 justify-center items-center bg-white dark:bg-neutral-900">
      <Text className="text-xl mb-4 text-neutral-950 dark:text-neutral-50">
        {t('notFound.message')}
      </Text>
      <Link href="/(learn)">
        <Text className="text-base text-primary-950 dark:text-primary-400">
          {t('notFound.goToLearn')}
        </Text>
      </Link>
    </View>
  );
}
