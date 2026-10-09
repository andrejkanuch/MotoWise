import { RequestDataExportDocument, UpdateUserDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { ArrowUpRight, BarChart3, Bug, Database, Shield, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { LEGAL_URL } from '../../../components/profile/constants';
import {
  ESectionLabel,
  ESettingsGroup,
  ESettingsRow,
  EToggleRow,
} from '../../../components/ui/editorial';
import { useDeleteAccount } from '../../../hooks/use-profile-data';
import {
  AnalyticsEvent,
  setAnalyticsEnabled,
  setCrashReportingEnabled,
  trackEvent,
} from '../../../lib/analytics';
import {
  type AccountPrivacyPreference,
  buildPrivacyUpdate,
  type ConsentDecision,
  getStoredAnalyticsConsent,
  type PrivacyChange,
} from '../../../lib/analytics-consent';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { meOptions } from '../../../lib/query-options';
import { useEditorialTheme } from '../../../theme/editorial';
import { GUTTER, readableWidth, space } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';

type PrivacyPrefs = {
  analyticsEnabled: boolean;
  crashReportingEnabled: boolean;
};

/**
 * Defaults for a rider with no saved server preference. Analytics follows the
 * on-device consent decision rather than defaulting on: in an opt-in region a
 * rider who has not accepted must not be opted in by opening this screen (the
 * mount effect below pushes these values into the SDKs).
 */
function privacyDefaults(): PrivacyPrefs {
  return {
    analyticsEnabled: getStoredAnalyticsConsent(),
    crashReportingEnabled: true,
  };
}

export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();
  const { confirmDeleteAccount, isDeleting } = useDeleteAccount(t);

  const meQuery = useQuery(meOptions());

  const prefs = (meQuery.data?.me?.preferences as { privacy?: AccountPrivacyPreference } | null)
    ?.privacy;

  const [state, setState] = useState<PrivacyPrefs>(privacyDefaults);
  /** The privacy object most recently sent from this screen (each update builds on it). */
  const lastSentRef = useRef<AccountPrivacyPreference | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (meQuery.data && !initialized) {
      // The analytics toggle shows what is in force on this device: the root
      // layout has already reconciled it with the account, and the raw account
      // value may be an untrusted legacy "yes". Opening this screen never
      // records a decision (it used to save the default "yes").
      const merged: PrivacyPrefs = {
        analyticsEnabled: getStoredAnalyticsConsent(),
        crashReportingEnabled:
          typeof prefs?.crashReportingEnabled === 'boolean'
            ? prefs.crashReportingEnabled
            : privacyDefaults().crashReportingEnabled,
      };
      setState(merged);
      setInitialized(true);
      setCrashReportingEnabled(merged.crashReportingEnabled);
    }
  }, [meQuery.data, prefs, initialized]);

  const updateMutation = useMutation({
    // Only the toggled setting changes (buildPrivacyUpdate); an analytics toggle
    // is a real, timestamped decision.
    mutationFn: (change: PrivacyChange) => {
      // Build on what was last SENT, not the cached `me`: a second toggle before
      // the refetch lands would otherwise resend the first setting's old value
      // (the server replaces `privacy` whole).
      const privacy = buildPrivacyUpdate(lastSentRef.current ?? prefs, change);
      lastSentRef.current = privacy;
      return gqlFetcher(UpdateUserDocument, { input: { preferences: { privacy } } });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.me }),
  });

  const toggle = useCallback(
    (key: keyof PrivacyPrefs, value: boolean) => {
      const next = { ...state, [key]: value };
      setState(next);

      // Sync with Sentry / PostHog
      if (key === 'analyticsEnabled') {
        const decision: ConsentDecision = { enabled: value, decidedAt: Date.now() };
        updateMutation.mutate({ analytics: decision });
        if (value) setAnalyticsEnabled(true, decision.decidedAt);
        trackEvent(AnalyticsEvent.SETTINGS_CHANGED, {
          setting: key,
          value,
          source: 'privacy',
        });
        if (!value) setAnalyticsEnabled(false, decision.decidedAt);
      } else if (key === 'crashReportingEnabled') {
        updateMutation.mutate({ crashReportingEnabled: value });
        setCrashReportingEnabled(value);
        trackEvent(AnalyticsEvent.SETTINGS_CHANGED, {
          setting: key,
          value,
          source: 'privacy',
        });
      }
    },
    [state, updateMutation.mutate],
  );

  const exportMutation = useMutation({
    mutationFn: () => gqlFetcher(RequestDataExportDocument),
    onSuccess: () => {
      Alert.alert(
        t('privacy.exportSuccessTitle', { defaultValue: 'Export Requested' }),
        t('privacy.exportSuccessMessage', {
          defaultValue:
            "We're preparing your data. You'll receive an email with a download link shortly.",
        }),
      );
    },
    onError: (error: Error) => {
      const isTooManyRequests = error.message?.includes('24 hours');
      Alert.alert(
        t('privacy.exportErrorTitle', { defaultValue: 'Export Failed' }),
        isTooManyRequests
          ? t('privacy.exportRateLimit', {
              defaultValue: 'You can only request a data export once every 24 hours.',
            })
          : t('privacy.exportError', {
              defaultValue: 'Something went wrong. Please try again later.',
            }),
      );
    },
  });

  const handleExportData = () => {
    triggerImpact();
    Alert.alert(
      t('privacy.exportTitle', { defaultValue: 'Export Your Data' }),
      t('privacy.exportMessage', {
        defaultValue: "We'll prepare a copy of your data and email it to you within 48 hours.",
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('privacy.export', { defaultValue: 'Export' }),
          onPress: () => {
            trackEvent(AnalyticsEvent.DATA_EXPORT_REQUESTED);
            exportMutation.mutate();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      testID="privacy-screen"
      contentInsetAdjustmentBehavior="automatic"
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{
        ...readableWidth,
        paddingHorizontal: GUTTER,
        paddingTop: space.md,
        paddingBottom: space.xxxl,
        gap: space.xl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <ESectionLabel label={t('privacy.dataCollection')} />
        <ESettingsGroup>
          <EToggleRow
            testID="privacy-analytics"
            icon={BarChart3}
            title={t('privacy.analytics')}
            subtitle={t('privacy.analyticsDesc')}
            value={state.analyticsEnabled}
            onValueChange={(v) => toggle('analyticsEnabled', v)}
          />
          <EToggleRow
            testID="privacy-crash-reporting"
            icon={Bug}
            title={t('privacy.crashReporting')}
            subtitle={t('privacy.crashReportingDesc')}
            value={state.crashReportingEnabled}
            onValueChange={(v) => toggle('crashReportingEnabled', v)}
          />
        </ESettingsGroup>
      </View>

      <View>
        <ESectionLabel label={t('privacy.yourData')} />
        <ESettingsGroup>
          <ESettingsRow
            testID="privacy-export"
            icon={Database}
            title={t('privacy.exportData')}
            subtitle={t('privacy.exportDataDesc')}
            loading={exportMutation.isPending}
            onPress={handleExportData}
          />
          <ESettingsRow
            testID="privacy-policy"
            icon={Shield}
            title={t('profile.privacyPolicy')}
            chevron={false}
            accessory={<ArrowUpRight size={17} color={theme.ink4} strokeWidth={2} />}
            onPress={() => void WebBrowser.openBrowserAsync(LEGAL_URL.PRIVACY)}
          />
        </ESettingsGroup>
      </View>

      {/* Same flow as Profile → Account → Delete account (useDeleteAccount). */}
      <View>
        <ESettingsGroup>
          <ESettingsRow
            testID="privacy-delete-account"
            icon={Trash2}
            title={isDeleting ? t('privacy.deletingAccount') : t('privacy.deleteAccount')}
            subtitle={t('privacy.deleteAccountDesc')}
            destructive
            loading={isDeleting}
            onPress={confirmDeleteAccount}
          />
        </ESettingsGroup>
      </View>
    </ScrollView>
  );
}
