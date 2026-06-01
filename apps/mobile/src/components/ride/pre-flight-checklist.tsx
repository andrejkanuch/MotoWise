import { MaintenanceTasksByMotorcycleDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { AlertCircle, Check, Cloud, Navigation, Wrench } from 'lucide-react-native';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useWeatherForecast } from '../../hooks/use-weather-forecast';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { tint, useEditorialTheme } from '../../theme/editorial';

interface PreFlightChecklistProps {
  motorcycleId?: string | null;
}

interface ChecklistItem {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  subtitle: string;
  status: 'ok' | 'warn' | 'na';
}

export function PreFlightChecklist({ motorcycleId }: PreFlightChecklistProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const [gpsStatus, setGpsStatus] = useState<'ok' | 'warn' | 'loading'>('loading');

  // GPS check
  useEffect(() => {
    let mounted = true;
    async function checkGps() {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (mounted) {
          setGpsStatus(status === Location.PermissionStatus.GRANTED ? 'ok' : 'warn');
        }
      } catch {
        if (mounted) setGpsStatus('warn');
      }
    }
    checkGps();
    return () => {
      mounted = false;
    };
  }, []);

  // Weather — real data from Open-Meteo
  const { data: weather, isLoading: weatherLoading } = useWeatherForecast();
  const todayWeather = weather?.days?.[0];

  // Maintenance tasks — real data for selected bike
  const { data: tasksData } = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId ?? ''),
    queryFn: () =>
      gqlFetcher(MaintenanceTasksByMotorcycleDocument, {
        motorcycleId: motorcycleId ?? '',
      }),
    enabled: !!motorcycleId,
  });

  const bikeStatus = useMemo(() => {
    if (!motorcycleId) return { subtitle: t('preFlight.noBikeSelected'), status: 'na' as const };
    const tasks = tasksData?.maintenanceTasks ?? [];
    if (tasks.length === 0)
      return { subtitle: t('preFlight.noTasksTracked'), status: 'na' as const };

    const now = new Date();
    const overdue = tasks.filter(
      (task) => task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < now,
    );
    const upcoming = tasks.filter(
      (task) => task.status !== 'completed' && task.dueDate && new Date(task.dueDate) >= now,
    );

    if (overdue.length > 0) {
      const first = overdue[0];
      return {
        subtitle: t('preFlight.overdue', { task: first.title }),
        status: 'warn' as const,
      };
    }

    if (upcoming.length > 0) {
      const first = upcoming[0];
      // dueDate is guaranteed non-null by the `upcoming` filter above.
      const daysUntil = Math.ceil(
        (new Date(first.dueDate ?? now).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        subtitle: t('preFlight.dueIn', { task: first.title, days: daysUntil }),
        status: daysUntil <= 7 ? ('warn' as const) : ('ok' as const),
      };
    }

    return { subtitle: t('preFlight.allClear'), status: 'ok' as const };
  }, [motorcycleId, tasksData, t]);

  const weatherSubtitle = useMemo(() => {
    if (weatherLoading) return t('preFlight.loading');
    if (!todayWeather) return t('preFlight.na');
    return `${todayWeather.label} · ${Math.round(todayWeather.tempMax)}°C · ${todayWeather.precipProbability}% ${t('preFlight.rain')}`;
  }, [todayWeather, weatherLoading, t]);

  const weatherStatus: 'ok' | 'warn' | 'na' = todayWeather
    ? todayWeather.weatherCode <= 3
      ? 'ok'
      : 'warn'
    : 'na';

  const items: ChecklistItem[] = [
    {
      icon: Navigation,
      label: t('preFlight.gps'),
      subtitle:
        gpsStatus === 'loading'
          ? t('preFlight.gpsChecking')
          : gpsStatus === 'ok'
            ? t('preFlight.gpsReady')
            : t('preFlight.gpsDenied'),
      status: gpsStatus === 'loading' ? 'na' : gpsStatus,
    },
    {
      icon: Cloud,
      label: t('preFlight.weather'),
      subtitle: weatherSubtitle,
      status: weatherStatus,
    },
    {
      icon: Wrench,
      label: t('preFlight.bikeStatus'),
      subtitle: bikeStatus.subtitle,
      status: bikeStatus.status,
    },
  ];

  const auxLabels: Record<string, string> = {
    ok: t('preFlight.auxOk', { defaultValue: 'OK' }),
    warn: t('preFlight.auxView', { defaultValue: 'View' }),
    na: '',
  };

  return (
    <View>
      <Text
        style={{
          fontFamily: 'GeistMono',
          fontSize: 10,
          fontWeight: '500',
          color: theme.ink3,
          textTransform: 'uppercase',
          letterSpacing: 10 * 0.22,
          marginBottom: 10,
          paddingHorizontal: 4,
        }}
      >
        {t('preFlight.title')}
      </Text>

      <View
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 22,
          borderCurve: 'continuous',
          paddingVertical: 4,
        }}
      >
        {items.map((item, index) => {
          const isOk = item.status === 'ok';
          const isWarn = item.status === 'warn';

          const iconBg = isOk
            ? tint(theme.success, 0.18)
            : isWarn
              ? tint(theme.warm, 0.18)
              : tint(theme.ink3, 0.08);

          const iconColor = isOk ? theme.success : isWarn ? theme.warm : theme.ink3;
          const StatusIcon = isOk ? Check : isWarn ? AlertCircle : null;
          const auxText = auxLabels[item.status] || '';

          return (
            <View key={item.label} style={{ position: 'relative' }}>
              {index > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 60,
                    right: 18,
                    height: 1,
                    backgroundColor: theme.line,
                  }}
                />
              )}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                }}
              >
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    borderCurve: 'continuous',
                    backgroundColor: iconBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {StatusIcon ? (
                    <StatusIcon size={14} color={iconColor} />
                  ) : (
                    <item.icon size={14} color={iconColor} />
                  )}
                </View>

                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: theme.ink,
                      letterSpacing: -15 * 0.012,
                      lineHeight: 15 * 1.2,
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12.5,
                      color: theme.ink3,
                      marginTop: 2,
                      letterSpacing: -0.05,
                    }}
                  >
                    {item.subtitle}
                  </Text>
                </View>

                {auxText ? (
                  <Text
                    style={{
                      fontFamily: 'GeistMono',
                      fontSize: 9.5,
                      fontWeight: '500',
                      letterSpacing: 9.5 * 0.16,
                      textTransform: 'uppercase',
                      color: isWarn ? theme.warm : theme.ink3,
                      flexShrink: 0,
                    }}
                  >
                    {auxText}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
