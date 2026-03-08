import { palette } from '@motolearn/design-system';
import { MeDocument, UpdateUserDocument } from '@motolearn/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AlertTriangle, ArrowLeft, Database, Shield } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Switch, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

type PrivacyPrefs = {
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;
};

const DEFAULTS: PrivacyPrefs = {
  analyticsEnabled: true,
  crashReportingEnabled: true,
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
  icon: typeof Shield;
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

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });

  const prefs = (meQuery.data?.me?.preferences as { privacy?: Partial<PrivacyPrefs> } | null)
    ?.privacy;

  const [state, setState] = useState<PrivacyPrefs>(DEFAULTS);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (meQuery.data && !initialized) {
      setState({ ...DEFAULTS, ...prefs });
      setInitialized(true);
    }
  }, [meQuery.data, prefs, initialized]);

  const updateMutation = useMutation({
    mutationFn: (privacy: PrivacyPrefs) =>
      gqlFetcher(UpdateUserDocument, { input: { preferences: { privacy } } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.me }),
  });

  const toggle = useCallback(
    (key: keyof PrivacyPrefs, value: boolean) => {
      const next = { ...state, [key]: value };
      setState(next);
      updateMutation.mutate(next);
    },
    [state, updateMutation],
  );

  const handleExportData = () => {
    haptic();
    Alert.alert(
      t('privacy.exportTitle', { defaultValue: 'Export Your Data' }),
      t('privacy.exportMessage', {
        defaultValue: "We'll prepare a copy of your data and email it to you within 48 hours.",
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('privacy.export', { defaultValue: 'Export' }), onPress: () => {} },
      ],
    );
  };

  const handleDeleteAccount = () => {
    haptic();
    Alert.alert(
      t('privacy.deleteTitle', { defaultValue: 'Delete Account' }),
      t('privacy.deleteMessage', {
        defaultValue:
          'This action is permanent and cannot be undone. All your data will be deleted.',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('privacy.deleteConfirm', { defaultValue: 'Contact Support' }),
              t('privacy.deleteConfirmMessage', {
                defaultValue: 'To delete your account, please contact support@motowise.app',
              }),
            );
          },
        },
      ],
    );
  };

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
          {t('privacy.title', { defaultValue: 'Privacy' })}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Data Collection */}
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
            {t('privacy.dataCollection', { defaultValue: 'Data Collection' })}
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
              icon={Shield}
              title={t('privacy.analytics', { defaultValue: 'Analytics' })}
              subtitle={t('privacy.analyticsDesc', {
                defaultValue: 'Help us improve MotoWise with usage data',
              })}
              value={state.analyticsEnabled}
              onToggle={(v) => toggle('analyticsEnabled', v)}
              isDark={isDark}
            />
            <ToggleRow
              icon={Shield}
              title={t('privacy.crashReporting', { defaultValue: 'Crash Reporting' })}
              subtitle={t('privacy.crashReportingDesc', {
                defaultValue: 'Automatically report app crashes',
              })}
              value={state.crashReportingEnabled}
              onToggle={(v) => toggle('crashReportingEnabled', v)}
              isDark={isDark}
              isLast
            />
          </View>
        </Animated.View>

        {/* Your Data */}
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
            {t('privacy.yourData', { defaultValue: 'Your Data' })}
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
            <Pressable
              onPress={handleExportData}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: pressed
                  ? isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.03)'
                  : 'transparent',
              })}
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
                <Database
                  size={17}
                  color={isDark ? palette.neutral300 : palette.neutral600}
                  strokeWidth={1.8}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text
                  style={{
                    fontSize: 16,
                    color: isDark ? palette.neutral50 : palette.neutral950,
                  }}
                >
                  {t('privacy.exportData', { defaultValue: 'Export My Data' })}
                </Text>
                <Text style={{ fontSize: 12, color: palette.neutral500, marginTop: 1 }}>
                  {t('privacy.exportDataDesc', {
                    defaultValue: 'Download a copy of your information',
                  })}
                </Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View
          entering={FadeInUp.delay(160).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 28 }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: palette.danger500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 8,
              marginLeft: 4,
            }}
          >
            {t('privacy.dangerZone', { defaultValue: 'Danger Zone' })}
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
            <Pressable
              onPress={handleDeleteAccount}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: pressed
                  ? isDark
                    ? 'rgba(255,255,255,0.05)'
                    : 'rgba(0,0,0,0.03)'
                  : 'transparent',
              })}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  borderCurve: 'continuous',
                  backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertTriangle size={17} color={palette.danger500} strokeWidth={1.8} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 16, color: palette.danger500, fontWeight: '600' }}>
                  {t('privacy.deleteAccount', { defaultValue: 'Delete Account' })}
                </Text>
                <Text style={{ fontSize: 12, color: palette.neutral500, marginTop: 1 }}>
                  {t('privacy.deleteAccountDesc', {
                    defaultValue: 'Permanently remove your account and data',
                  })}
                </Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
