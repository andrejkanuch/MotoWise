import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

export default function DiagnoseScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View className="flex-1 justify-center items-center bg-white dark:bg-neutral-900">
      <Pressable
        className="bg-primary-950 dark:bg-primary-500 rounded-xl px-6 py-4"
        style={{ borderCurve: 'continuous' }}
        onPress={() => router.push('/(diagnose)/new')}
      >
        <Text className="text-white text-base font-semibold">{t('diagnose.startNew')}</Text>
      </Pressable>
    </View>
  );
}
