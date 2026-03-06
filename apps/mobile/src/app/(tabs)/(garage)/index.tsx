import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

export default function GarageScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-1 p-4 bg-white dark:bg-neutral-900">
      <Text className="text-2xl font-bold mb-4 text-neutral-950 dark:text-neutral-50">
        {t('garage.title')}
      </Text>
      <Pressable
        className="bg-primary-950 dark:bg-primary-500 rounded-xl p-4 items-center"
        style={{ borderCurve: 'continuous' }}
        onPress={() => router.push('/(garage)/add-bike')}
      >
        <Text className="text-white text-base font-semibold">{t('garage.addBike')}</Text>
      </Pressable>
    </View>
  );
}
