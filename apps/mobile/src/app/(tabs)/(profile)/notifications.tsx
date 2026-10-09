import { UpdateUserDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  GraduationCap,
  type LucideIcon,
  Megaphone,
  Smartphone,
  Stethoscope,
  Wrench,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, View } from 'react-native';
import {
  ESectionLabel,
  ESettingsGroup,
  ESettingsRow,
  EToggleRow,
} from '../../../components/ui/editorial';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { meOptions } from '../../../lib/query-options';
import { useEditorialTheme } from '../../../theme/editorial';
import { GUTTER, readableWidth, space } from '../../../theme/type';

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

/** Data-driven groups: one ESettingsGroup per entry, one toggle per row. */
const GROUPS = [
  {
    labelKey: 'notifications.bikeSection',
    rows: [
      { key: 'maintenanceTips', icon: Wrench, titleKey: 'notifications.maintenanceTips' },
      { key: 'diagnosticAlerts', icon: Stethoscope, titleKey: 'notifications.diagnosticAlerts' },
    ],
  },
  {
    labelKey: 'notifications.learning',
    rows: [
      { key: 'newArticles', icon: BookOpen, titleKey: 'notifications.newArticles' },
      { key: 'quizReminders', icon: GraduationCap, titleKey: 'notifications.quizReminders' },
    ],
  },
  {
    labelKey: 'notifications.general',
    rows: [
      { key: 'appUpdates', icon: Bell, titleKey: 'notifications.appUpdates' },
      { key: 'promotional', icon: Megaphone, titleKey: 'notifications.promotional' },
    ],
  },
] as const satisfies readonly {
  labelKey: string;
  rows: readonly { key: keyof NotificationPrefs; icon: LucideIcon; titleKey: string }[];
}[];

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();

  const meQuery = useQuery(meOptions());

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
    <ScrollView
      testID="notifications-screen"
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
      {/* The OS switch is the one that actually silences ride and service
          reminders on this device; the toggles below are account preferences. */}
      <View>
        <ESettingsGroup>
          <ESettingsRow
            testID="notifications-system-settings"
            icon={Smartphone}
            title={t('notifications.systemSettings')}
            subtitle={t('notifications.systemSettingsDesc')}
            chevron={false}
            accessory={<ArrowUpRight size={17} color={theme.ink4} strokeWidth={2} />}
            onPress={() => void Linking.openSettings()}
          />
        </ESettingsGroup>
      </View>

      {GROUPS.map((group) => (
        <View key={group.labelKey}>
          <ESectionLabel label={t(group.labelKey)} />
          <ESettingsGroup>
            {group.rows.map((row) => (
              <EToggleRow
                key={row.key}
                testID={`notifications-${row.key}`}
                icon={row.icon}
                title={t(row.titleKey)}
                subtitle={t(`${row.titleKey}Desc`)}
                value={state[row.key]}
                onValueChange={(v) => toggle(row.key, v)}
              />
            ))}
          </ESettingsGroup>
        </View>
      ))}
    </ScrollView>
  );
}
