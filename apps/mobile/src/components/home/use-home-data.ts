import { palette } from '@motolearn/design-system';
import {
  AllMaintenanceTasksDocument,
  MeDocument,
  MyMotorcyclesDocument,
  SearchArticlesDocument,
} from '@motolearn/graphql';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  BookOpen,
  BookOpen as BookOpenIcon,
  Camera,
  CheckCircle2,
  Gauge,
  Plus,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { gqlFetcher } from '../../lib/graphql-client';
import { computeHealthScore, getRelativeDueDate } from '../../lib/health-score';
import { queryKeys } from '../../lib/query-keys';
import { getContextualSubtitleKey, getGreeting } from './home-helpers';
import type {
  FleetHealth,
  PriorityAction,
  QuickAction,
  TaskItem,
  TaskWithRelative,
} from './home-types';

export function useHomeData() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });
  const bikesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const articlesQuery = useQuery({
    queryKey: queryKeys.articles.list({ sortBy: 'popular' }),
    queryFn: () =>
      gqlFetcher(SearchArticlesDocument, {
        input: { first: 6 },
      }),
  });
  const maintenanceQuery = useQuery({
    queryKey: queryKeys.maintenanceTasks.allUser,
    queryFn: () => gqlFetcher(AllMaintenanceTasksDocument),
  });

  const user = meQuery.data?.me;
  const preferences = user?.preferences as
    | { onboardingCompleted?: boolean; experienceLevel?: string }
    | null
    | undefined;
  const motorcycles = bikesQuery.data?.myMotorcycles ?? [];
  const articles = articlesQuery.data?.searchArticles?.edges ?? [];
  const allTasks = maintenanceQuery.data?.allMaintenanceTasks ?? [];

  const showSetupCta = !preferences?.onboardingCompleted || motorcycles.length === 0;
  const hasMotorcycles = motorcycles.length > 0;
  const isLoading = meQuery.isLoading || bikesQuery.isLoading;
  const hasCriticalError = meQuery.isError || bikesQuery.isError;
  const isRefreshing =
    meQuery.isRefetching || bikesQuery.isRefetching || articlesQuery.isRefetching;
  const errorMessage = (meQuery.error as Error)?.message ?? (bikesQuery.error as Error)?.message;

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
    queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.articles.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
  }, [queryClient]);

  const firstName = user?.fullName?.split(' ')[0];
  const avatarInitial = user?.fullName?.charAt(0)?.toUpperCase() ?? '?';
  const greeting = getGreeting();

  const bikeNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const m of motorcycles) {
      names[m.id] = `${(m as { make: string }).make} ${(m as { model: string }).model}`;
    }
    return names;
  }, [motorcycles]);

  const fleetHealth: FleetHealth | null = useMemo(() => {
    if (motorcycles.length === 0) return null;

    const bikeScores = motorcycles.map((bike: { id: string; isPrimary: boolean }) => {
      const bikeTasks = allTasks.filter(
        (t: { motorcycleId: string }) => t.motorcycleId === bike.id,
      );
      const score = computeHealthScore(bikeTasks);
      return { bikeId: bike.id, isPrimary: bike.isPrimary, ...score };
    });

    let totalWeight = 0;
    let weightedScore = 0;
    let totalOverdue = 0;
    let totalUrgent = 0;
    let anyHasData = false;

    for (const bs of bikeScores) {
      const weight = bs.isPrimary ? 1.5 : 1;
      if (bs.hasData) {
        weightedScore += bs.score * weight;
        totalWeight += weight;
        anyHasData = true;
      }
      totalOverdue += bs.overdueTasks;
      totalUrgent += bs.urgentTasks;
    }

    const avgScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
    const needsAttention = bikeScores.filter(
      (bs) => bs.overdueTasks > 0 || (bs.hasData && bs.score < 60),
    ).length;

    return {
      score: avgScore,
      hasData: anyHasData,
      bikeCount: motorcycles.length,
      needsAttention,
      totalOverdue,
      totalUrgent,
      upcomingTasks: allTasks.filter((t: { status: string; dueDate?: string | null }) => {
        if (t.status !== 'pending' && t.status !== 'in_progress') return false;
        if (!t.dueDate) return false;
        const days = Math.floor((new Date(t.dueDate).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 7;
      }).length,
    };
  }, [motorcycles, allTasks]);

  const sortedTasks: TaskWithRelative[] = useMemo(() => {
    return (allTasks as TaskItem[])
      .filter((t) => (t.status === 'pending' || t.status === 'in_progress') && t.dueDate)
      .map((t) => ({
        ...t,
        relative: getRelativeDueDate(t.dueDate as string),
      }))
      .sort((a, b) => {
        if (a.relative.isOverdue && !b.relative.isOverdue) return -1;
        if (!a.relative.isOverdue && b.relative.isOverdue) return 1;
        return a.relative.daysAway - b.relative.daysAway;
      })
      .slice(0, 5);
  }, [allTasks]);

  const priorityAction: PriorityAction | null = useMemo(() => {
    if (!hasMotorcycles) return null;

    const overdueTasks = sortedTasks.filter((t) => t.relative.isOverdue);
    if (overdueTasks.length > 0) {
      const task = overdueTasks[0];
      const bikeName = bikeNames[task.motorcycleId] ?? t('home.yourBike');
      const relativeText = t(task.relative.key as never, task.relative.params as never);
      return {
        type: 'overdue',
        title: task.title,
        subtitle: `${bikeName} — ${relativeText}`,
        ctaLabel: t('home.priorityCompleteTask'),
        accentColor: palette.danger500,
        icon: AlertTriangle,
        onPress: () =>
          router.navigate({
            pathname: '/(tabs)/(garage)/bike/[id]',
            params: {
              id: task.motorcycleId,
              highlightTask: task.id,
              _ts: Date.now().toString(),
            },
          }),
      };
    }

    const urgentTasks = sortedTasks.filter(
      (t) => !t.relative.isOverdue && t.relative.daysAway <= 3,
    );
    if (urgentTasks.length > 0) {
      const task = urgentTasks[0];
      const bikeName = bikeNames[task.motorcycleId] ?? t('home.yourBike');
      const relativeText = t(task.relative.key as never, task.relative.params as never);
      return {
        type: 'upcoming',
        title: task.title,
        subtitle: `${bikeName} — ${relativeText}`,
        ctaLabel: t('home.priorityViewTask'),
        accentColor: palette.warning500,
        icon: Wrench,
        onPress: () =>
          router.navigate({
            pathname: '/(tabs)/(garage)/bike/[id]',
            params: {
              id: task.motorcycleId,
              highlightTask: task.id,
              _ts: Date.now().toString(),
            },
          }),
      };
    }

    if (articles.length > 0) {
      return {
        type: 'learning',
        title: t('home.priorityLearnTitle'),
        subtitle: t('home.priorityLearnSubtitle'),
        ctaLabel: t('home.priorityExplore'),
        accentColor: palette.primary500,
        icon: BookOpenIcon,
        onPress: () => router.push('/(tabs)/(learn)'),
      };
    }

    return {
      type: 'allClear',
      title: t('home.priorityAllClearTitle'),
      subtitle: t('home.priorityAllClearSubtitle'),
      ctaLabel: t('home.priorityViewGarage'),
      accentColor: palette.success500,
      icon: CheckCircle2,
      onPress: () => router.navigate('/(tabs)/(garage)'),
    };
  }, [hasMotorcycles, sortedTasks, bikeNames, articles, t, router]);

  const quickActions: QuickAction[] = useMemo(() => {
    if (!hasMotorcycles || showSetupCta) {
      return [
        {
          key: 'addBike',
          icon: Plus,
          titleKey: 'home.actionAddBike',
          route: '/(tabs)/(garage)/add-bike',
          color: palette.primary500,
          bgLight: palette.primary100,
          bgDark: palette.primary900,
        },
        {
          key: 'explore',
          icon: BookOpen,
          titleKey: 'home.actionExploreLearning',
          route: '/(tabs)/(learn)',
          color: palette.moduleSuspension,
          bgLight: palette.primary100,
          bgDark: palette.primary900,
        },
        {
          key: 'diagnose',
          icon: Camera,
          titleKey: 'home.actionDiagnose',
          route: '/(tabs)/(diagnose)',
          color: palette.moduleEngine,
          bgLight: palette.dangerBgLight,
          bgDark: palette.dangerBgDark,
        },
      ];
    }

    return [
      {
        key: 'mileage',
        icon: Gauge,
        titleKey: 'home.actionUpdateMileage',
        route: '/(tabs)/(garage)',
        color: palette.moduleSuspension,
        bgLight: palette.primary100,
        bgDark: palette.primary900,
      },
      {
        key: 'addTask',
        icon: Plus,
        titleKey: 'home.actionAddTask',
        route: '/(tabs)/(garage)',
        color: palette.moduleMaintenance,
        bgLight: palette.successBgLight,
        bgDark: palette.successBgDark,
      },
      {
        key: 'diagnose',
        icon: Camera,
        titleKey: 'home.actionDiagnose',
        route: '/(tabs)/(diagnose)',
        color: palette.moduleEngine,
        bgLight: palette.dangerBgLight,
        bgDark: palette.dangerBgDark,
      },
      {
        key: 'learn',
        icon: BookOpen,
        titleKey: 'home.actionLearn',
        route: '/(tabs)/(learn)',
        color: palette.moduleElectrical,
        bgLight: palette.warningBgLight,
        bgDark: palette.warningBgDark,
      },
    ];
  }, [hasMotorcycles, showSetupCta]);

  const subtitleInfo = getContextualSubtitleKey(
    greeting.subtitleKey,
    fleetHealth?.totalOverdue ?? 0,
    fleetHealth?.upcomingTasks ?? 0,
  );

  const greetingText = firstName
    ? t(greeting.key, { name: firstName })
    : t('home.greetingFallback');
  const subtitleText = String(t(subtitleInfo.key as never, subtitleInfo.opts as never));

  return {
    isLoading,
    hasCriticalError,
    errorMessage,
    isRefreshing,
    onRefresh,
    greetingText,
    subtitleText,
    avatarInitial,
    hasMotorcycles,
    showSetupCta,
    fleetHealth,
    singleBikeName: motorcycles.length === 1 ? bikeNames[motorcycles[0].id] : undefined,
    priorityAction,
    quickActions,
    sortedTasks,
    bikeNames,
    articles,
    router,
  };
}
