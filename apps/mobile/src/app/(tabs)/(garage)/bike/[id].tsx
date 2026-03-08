import { colors } from '@motolearn/design-system';
import { DeleteMotorcycleDocument, MyMotorcyclesDocument } from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { queryKeys } from '../../../../lib/query-keys';

export default function BikeDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const { mutateAsync: deleteBike, isPending: deleting } = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const bike = (data?.myMotorcycles ?? []).find((m: { id: string }) => m.id === id);

  const handleDelete = () => {
    Alert.alert(t('garage.deleteBike'), t('garage.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBike();
            router.back();
          } catch (e) {
            Alert.alert(t('common.error'), String(e));
          }
        },
      },
    ]);
  };

  if (isLoading && !data) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900">
        <ActivityIndicator size="large" color={colors.primary[500]} />
      </View>
    );
  }

  if (error || !bike) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-neutral-900 p-6">
        <Text className="text-base text-neutral-500 text-center">
          {error ? t('common.error') : t('notFound.message')}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900 p-6">
      <Animated.View
        entering={FadeInUp.duration(400)}
        className="bg-white dark:bg-neutral-800 rounded-2xl p-6"
        style={{ borderCurve: 'continuous' }}
      >
        <Text className="text-2xl font-bold text-neutral-950 dark:text-neutral-50 mb-1">
          {bike.make} {bike.model}
        </Text>
        <Text className="text-base text-neutral-500 mb-4">{bike.year}</Text>

        {bike.nickname && (
          <View className="mb-4">
            <Text className="text-sm text-neutral-400">{t('garage.nickname')}</Text>
            <Text className="text-base text-neutral-950 dark:text-neutral-50">{bike.nickname}</Text>
          </View>
        )}

        {bike.isPrimary && (
          <View
            className="bg-primary-500 rounded-full px-3 py-1 self-start mb-4"
            style={{ borderCurve: 'continuous' }}
          >
            <Text className="text-white text-xs font-semibold">Primary</Text>
          </View>
        )}
      </Animated.View>

      <Pressable
        className="bg-danger-500 rounded-xl p-4 items-center mt-6"
        style={{
          borderCurve: 'continuous',
          backgroundColor: colors.danger[500],
        }}
        onPress={handleDelete}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <Text className="text-white text-base font-semibold">{t('garage.deleteBike')}</Text>
        )}
      </Pressable>
    </View>
  );
}
