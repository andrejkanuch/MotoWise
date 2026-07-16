import { MyMotorcyclesDocument } from '@motovault/graphql';
import { mileageToDisplayUnit, mileageUnitLabel } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Route } from 'lucide-react-native';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useEditorialTheme } from '../../theme/editorial';

export const BikeBanner = memo(function BikeBanner() {
  const { t } = useEditorialTheme();
  const { t: translate } = useTranslation();
  const system = useMeasurementSystem();

  const { data } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
    staleTime: 5 * 60 * 1000,
  });

  const bike = useMemo(() => {
    const bikes = data?.myMotorcycles ?? [];
    return bikes.find((b) => b.isPrimary) ?? bikes[0] ?? null;
  }, [data]);

  if (!bike) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        paddingHorizontal: 12,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: 12,
        borderCurve: 'continuous',
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          borderCurve: 'continuous',
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Route size={15} color={t.warm} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: 'GeistMono',
            fontSize: 10,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: t.ink3,
            marginBottom: 1,
          }}
        >
          {translate('discover.forYourBike', { defaultValue: 'For your bike' })}
        </Text>
        <Text style={{ fontSize: 13, color: t.ink, fontWeight: '500' }} numberOfLines={1}>
          {bike.make} {bike.model}{' '}
          <Text style={{ color: t.ink3, fontWeight: '400' }}>
            · {bike.type ?? 'motorcycle'} ·{' '}
            {Math.round(mileageToDisplayUnit(bike.currentMileage ?? 0, system)).toLocaleString()}{' '}
            {mileageUnitLabel(system)}
          </Text>
        </Text>
      </View>
      <ChevronRight size={14} color={t.ink3} />
    </View>
  );
});
