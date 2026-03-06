import { colors } from '@motolearn/design-system';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gql, useQuery } from 'urql';

const MyMotorcyclesQuery = gql`
  query MyMotorcycles {
    myMotorcycles {
      id
      make
      model
      year
      nickname
      isPrimary
      createdAt
    }
  }
`;

export default function GarageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [{ data, fetching, error }, reexecute] = useQuery({
    query: MyMotorcyclesQuery,
  });

  const onRefresh = useCallback(() => {
    reexecute({ requestPolicy: 'network-only' });
  }, [reexecute]);

  const motorcycles = data?.myMotorcycles ?? [];

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900">
      {fetching && !data ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary[500]} />
          <Text className="mt-3 text-sm text-neutral-500">{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base text-neutral-950 dark:text-neutral-50 mb-4 text-center">
            {t('common.error')}
          </Text>
          <Pressable
            className="bg-primary-950 dark:bg-primary-500 rounded-xl px-6 py-3"
            style={{ borderCurve: 'continuous' }}
            onPress={onRefresh}
          >
            <Text className="text-white text-base font-semibold">{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : motorcycles.length === 0 ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-base text-neutral-500 mb-4 text-center">{t('garage.noBikes')}</Text>
          <Pressable
            className="bg-primary-950 dark:bg-primary-500 rounded-xl px-6 py-3"
            style={{ borderCurve: 'continuous' }}
            onPress={() => router.push('/(garage)/add-bike')}
          >
            <Text className="text-white text-base font-semibold">{t('garage.addFirstBike')}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 gap-3"
          refreshControl={
            <RefreshControl
              refreshing={fetching}
              onRefresh={onRefresh}
              tintColor={colors.primary[500]}
            />
          }
        >
          {motorcycles.map(
            (
              bike: {
                id: string;
                make: string;
                model: string;
                year: number;
                nickname?: string;
                isPrimary: boolean;
              },
              index: number,
            ) => (
              <Animated.View key={bike.id} entering={FadeInUp.delay(index * 80).duration(400)}>
                <Pressable
                  className="bg-white dark:bg-neutral-800 rounded-2xl p-4"
                  style={{ borderCurve: 'continuous' }}
                  onPress={() => router.push(`/(garage)/bike/${bike.id}`)}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-lg font-bold text-neutral-950 dark:text-neutral-50">
                        {bike.make} {bike.model}
                      </Text>
                      <Text className="text-sm text-neutral-500">
                        {bike.year}
                        {bike.nickname ? ` \u2022 ${bike.nickname}` : ''}
                      </Text>
                    </View>
                    {bike.isPrimary && (
                      <View
                        className="bg-primary-500 rounded-full px-3 py-1"
                        style={{ borderCurve: 'continuous' }}
                      >
                        <Text className="text-white text-xs font-semibold">Primary</Text>
                      </View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ),
          )}
        </ScrollView>
      )}

      {motorcycles.length > 0 && (
        <View className="absolute bottom-6 right-6">
          <Pressable
            className="bg-primary-950 dark:bg-primary-500 w-14 h-14 rounded-full items-center justify-center"
            style={{
              borderCurve: 'continuous',
              shadowColor: colors.neutral[950],
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={() => router.push('/(garage)/add-bike')}
          >
            <Text className="text-white text-2xl font-light">+</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
