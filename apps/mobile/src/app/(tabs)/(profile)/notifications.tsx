import { palette } from '@motovault/design-system';
import { MeDocument, UpdateUserDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowLeft, Bell, BookOpen, Megaphone, Wrench } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

type NotificationPrefs = {
  newArticles: boolean;
  quizReminders: boolean;
  diagnosticAlerts: boolean;
  maintenanceTips: boolean;
  appUpdates: boolean;
  promotional: boolean;
};

const DEFAULTS: NotificationPrefs = {
  newArticles: true,
  quizReminders: true,
  diagnosticAlerts: true,
  maintenanceTips: true,
  appUpdates: true,
  promotional: false,
};

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function ToggleRow({
  icon: Icon,
  title,
  subtitle,
  value,
  onToggle,
  isDark,
  isLast,
}: {
  icon: typeof Bell;
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  isDark: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          borderCurve: 'continuous',
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.neutral100,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          size={17}
          color={isDark ? palette.neutral300 : palette.neutral600}
          strokeWidth={1.8}
        />
      </View>
      <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
        <Text
          style={{
            fontSize: 16,
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {title}
        </Text>
        <Text style={{ fontSize: 12, color: palette.neutral500, marginTop: 1 }}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          haptic();
          onToggle(v);
        }}
        trackColor={{ false: palette.neutral300, true: palette.primary500 }}
        thumbColor={palette.white}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });

  const prefs = (
    meQuery.data?.me?.preferences as { notifications?: Partial<NotificationPrefs> } | null
  )?.notifications;

  const [state, setState] = useState<NotificationPrefs>(DEFAULTS);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (meQuery.data && !initialized) {
      setState({ ...DEFAULTS, ...prefs });
      setInitialized(true);
    }
  }, [meQuery.data, prefs, initialized]);

  const updateMutation = useMutation({
    mutationFn: (notifications: NotificationPrefs) =>
      gqlFetcher(UpdateUserDocument, { input: { preferences: { notifications } } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.me }),
  });

  const toggle = useCallback(
    (key: keyof NotificationPrefs, value: boolean) => {
      const next = { ...state, [key]: value };
      setState(next);
      updateMutation.mutate(next);
    },
    [state, updateMutation],
  );

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? palette.neutral900 : palette.neutral50 }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 0.5,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <Pressable
          onPress={() => {
            haptic();
            router.back();
          }}
          hitSlop={12}
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            borderCurve: 'continuous',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.neutral100,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft
            size={18}
            color={isDark ? palette.neutral300 : palette.neutral600}
            strokeWidth={2}
          />
        </Pressable>
        <Text
          style={{
            flex: 1,
            fontSize: 17,
            fontWeight: '600',
            color: isDark ? palette.neutral50 : palette.neutral950,
            textAlign: 'center',
            marginRight: 34,
          }}
        >
          {t('notifications.title', { defaultValue: 'Notifications' })}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Learning */}
        <Animated.View
          entering={FadeInUp.duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 24 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: palette.neutral500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('notifications.learning', { defaultValue: 'Learning' })}
          </Text>
          <View
            style={{
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 16,
              borderCurve: 'continuous',
              overflow: 'hidden',
              boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <ToggleRow
              icon={BookOpen}
              title={t('notifications.newArticles', { defaultValue: 'New Articles' })}
              subtitle={t('notifications.newArticlesDesc', {
                defaultValue: 'When new learning content is available',
              })}
              value={state.newArticles}
              onToggle={(v) => toggle('newArticles', v)}
              isDark={isDark}
            />
            <ToggleRow
              icon={BookOpen}
              title={t('notifications.quizReminders', { defaultValue: 'Quiz Reminders' })}
              subtitle={t('notifications.quizRemindersDesc', {
                defaultValue: 'Reminders to complete quizzes',
              })}
              value={state.quizReminders}
              onToggle={(v) => toggle('quizReminders', v)}
              isDark={isDark}
              isLast
            />
          </View>
        </Animated.View>

        {/* Diagnostics */}
        <Animated.View
          entering={FadeInUp.delay(80).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 28 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: palette.neutral500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('notifications.diagnostics', { defaultValue: 'Diagnostics' })}
          </Text>
          <View
            style={{
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 16,
              borderCurve: 'continuous',
              overflow: 'hidden',
              boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <ToggleRow
              icon={Wrench}
              title={t('notifications.diagnosticAlerts', { defaultValue: 'Diagnostic Alerts' })}
              subtitle={t('notifications.diagnosticAlertsDesc', {
                defaultValue: 'Updates on your diagnostic results',
              })}
              value={state.diagnosticAlerts}
              onToggle={(v) => toggle('diagnosticAlerts', v)}
              isDark={isDark}
            />
            <ToggleRow
              icon={Wrench}
              title={t('notifications.maintenanceTips', { defaultValue: 'Maintenance Tips' })}
              subtitle={t('notifications.maintenanceTipsDesc', {
                defaultValue: 'Periodic maintenance reminders',
              })}
              value={state.maintenanceTips}
              onToggle={(v) => toggle('maintenanceTips', v)}
              isDark={isDark}
              isLast
            />
          </View>
        </Animated.View>

        {/* General */}
        <Animated.View
          entering={FadeInUp.delay(160).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 28 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: palette.neutral500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('notifications.general', { defaultValue: 'General' })}
          </Text>
          <View
            style={{
              backgroundColor: isDark ? palette.neutral800 : palette.white,
              borderRadius: 16,
              borderCurve: 'continuous',
              overflow: 'hidden',
              boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.05)',
            }}
          >
            <ToggleRow
              icon={Bell}
              title={t('notifications.appUpdates', { defaultValue: 'App Updates' })}
              subtitle={t('notifications.appUpdatesDesc', {
                defaultValue: 'New features and improvements',
              })}
              value={state.appUpdates}
              onToggle={(v) => toggle('appUpdates', v)}
              isDark={isDark}
            />
            <ToggleRow
              icon={Megaphone}
              title={t('notifications.promotional', { defaultValue: 'Promotional' })}
              subtitle={t('notifications.promotionalDesc', {
                defaultValue: 'Special offers and announcements',
              })}
              value={state.promotional}
              onToggle={(v) => toggle('promotional', v)}
              isDark={isDark}
              isLast
            />
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
