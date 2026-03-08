import { palette } from '@motolearn/design-system';
import { DeleteMotorcycleDocument, MyMotorcyclesDocument } from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, Edit3, Star, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { BikeIcon } from '../../../../components/BikeIcon';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { queryKeys } from '../../../../lib/query-keys';

const BIKE_VARIANTS = ['sport', 'cruiser', 'adventure', 'standard'] as const;

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function InfoRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <Text style={{ fontSize: 14, color: palette.neutral500 }}>{label}</Text>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: isDark ? palette.neutral50 : palette.neutral950,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export default function BikeDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const { mutateAsync: deleteBike, isPending: deleting } = useMutation({
    mutationFn: () => gqlFetcher(DeleteMotorcycleDocument, { id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
  });

  const motorcycles = data?.myMotorcycles ?? [];
  const bikeIndex = motorcycles.findIndex((m: { id: string }) => m.id === id);
  const bike = motorcycles[bikeIndex];
  const variant = BIKE_VARIANTS[Math.max(bikeIndex, 0) % BIKE_VARIANTS.length];

  const handleDelete = () => {
    haptic();
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
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
        }}
      >
        <ActivityIndicator size="large" color={palette.primary500} />
      </View>
    );
  }

  if (!bike) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? palette.neutral900 : palette.neutral50,
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 16, color: palette.neutral500, textAlign: 'center' }}>
          {t('notFound.message', { defaultValue: 'Not found' })}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      {/* Hero */}
      <Animated.View entering={FadeInUp.duration(400)}>
        <LinearGradient
          colors={isDark ? ['#1a1a2e', '#16213e'] : [palette.primary50, palette.primary100]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: 200,
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <BikeIcon
            variant={variant}
            size={80}
            color={isDark ? 'rgba(255,255,255,0.2)' : palette.primary300}
          />

          {bike.isPrimary && (
            <View
              style={{
                position: 'absolute',
                top: 16,
                left: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: 'rgba(245,158,11,0.9)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderCurve: 'continuous',
              }}
            >
              <Star size={13} color={palette.white} strokeWidth={2.5} fill={palette.white} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: palette.white }}>Primary</Text>
            </View>
          )}

          <Pressable
            onPress={() => {
              haptic();
              router.push({ pathname: '/(garage)/edit-bike', params: { id: bike.id } });
            }}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: 36,
              height: 36,
              borderRadius: 10,
              borderCurve: 'continuous',
              backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Edit3 size={16} color={isDark ? palette.white : palette.neutral700} strokeWidth={2} />
          </Pressable>
        </LinearGradient>
      </Animated.View>

      {/* Info */}
      <Animated.View
        entering={FadeInUp.delay(80).duration(400)}
        style={{ paddingHorizontal: 20, marginTop: 20 }}
      >
        {bike.nickname && (
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: palette.primary500,
              marginBottom: 4,
            }}
          >
            &ldquo;{bike.nickname}&rdquo;
          </Text>
        )}
        <Text
          style={{
            fontSize: 26,
            fontWeight: '800',
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {bike.make} {bike.model}
        </Text>

        <View style={{ flexDirection: 'row', gap: 16, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Calendar size={14} color={palette.neutral400} strokeWidth={2} />
            <Text style={{ fontSize: 14, color: palette.neutral500, fontWeight: '500' }}>
              {bike.year}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Wrench size={14} color={palette.neutral400} strokeWidth={2} />
            <Text style={{ fontSize: 14, color: palette.neutral500, fontWeight: '500' }}>
              {t('garage.serviceRecords', { defaultValue: 'Service' })}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* Details Card */}
      <Animated.View
        entering={FadeInUp.delay(160).duration(400)}
        style={{ paddingHorizontal: 20, marginTop: 24 }}
      >
        <View
          style={{
            backgroundColor: isDark ? palette.neutral800 : palette.white,
            borderRadius: 16,
            borderCurve: 'continuous',
            padding: 16,
            boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
          }}
        >
          <InfoRow
            label={t('garage.make', { defaultValue: 'Make' })}
            value={bike.make}
            isDark={isDark}
          />
          <InfoRow
            label={t('garage.model', { defaultValue: 'Model' })}
            value={bike.model}
            isDark={isDark}
          />
          <InfoRow
            label={t('garage.year', { defaultValue: 'Year' })}
            value={String(bike.year)}
            isDark={isDark}
          />
          {bike.nickname && (
            <InfoRow
              label={t('garage.nickname', { defaultValue: 'Nickname' })}
              value={bike.nickname}
              isDark={isDark}
            />
          )}
          <InfoRow
            label={t('garage.primary', { defaultValue: 'Primary' })}
            value={
              bike.isPrimary
                ? t('common.yes', { defaultValue: 'Yes' })
                : t('common.no', { defaultValue: 'No' })
            }
            isDark={isDark}
          />
        </View>
      </Animated.View>

      {/* Delete */}
      <Animated.View
        entering={FadeInUp.delay(240).duration(400)}
        style={{ paddingHorizontal: 20, marginTop: 32 }}
      >
        <Pressable
          onPress={handleDelete}
          disabled={deleting}
          style={{
            backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
            borderRadius: 14,
            borderCurve: 'continuous',
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={palette.danger500} />
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '600', color: palette.danger500 }}>
              {t('garage.deleteBike', { defaultValue: 'Delete Motorcycle' })}
            </Text>
          )}
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}
