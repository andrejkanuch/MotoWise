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
    // biome-ignore lint/suspicious/noExplicitAny: generated type shape
    const tasks = (tasksData as any)?.maintenanceTasks ?? [];
    if (tasks.length === 0)
      return { subtitle: t('preFlight.noTasksTracked'), status: 'na' as const };

    const now = new Date();
    const overdue = tasks.filter(
      (task: { status: string; dueDate?: string | null }) =>
        task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < now,
    );
    const upcoming = tasks.filter(
      (task: { status: string; dueDate?: string | null }) =>
        task.status !== 'completed' && task.dueDate && new Date(task.dueDate) >= now,
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
      const daysUntil = Math.ceil(
        (new Date(first.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
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

  return (
    <View>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '600',
          color: theme.ink3,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
          marginBottom: 8,
        }}
      >
        {t('preFlight.title')}
      </Text>

      <View
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.line,
          borderRadius: 14,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          paddingVertical: 4,
        }}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          const isOk = item.status === 'ok';
          const isWarn = item.status === 'warn';

          const iconBg = isOk
            ? tint(theme.success, 0.12)
            : isWarn
              ? tint(theme.warm, 0.1)
              : tint(theme.ink3, 0.08);

          const iconColor = isOk ? theme.success : isWarn ? theme.warm : theme.ink3;
          const StatusIcon = isOk ? Check : isWarn ? AlertCircle : null;

          return (
            <View
              key={item.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 11,
                borderBottomWidth: index < items.length - 1 ? 1 : 0,
                borderBottomColor: theme.line2,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  borderCurve: 'continuous',
                  backgroundColor: iconBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {StatusIcon ? (
                  <StatusIcon size={14} color={iconColor} />
                ) : (
                  <Icon size={14} color={iconColor} />
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: theme.ink }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 11, color: theme.ink3, marginTop: 1 }}>
                  {item.subtitle}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
