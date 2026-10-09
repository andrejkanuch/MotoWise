import { UpdateMyProfileDocument, UpdateUserDocument } from '@motovault/graphql';
import {
  BIO_MAX_LENGTH,
  CITY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  ExperienceLevel,
  RESERVED_USERNAMES,
  RidingGoal,
  USERNAME_MAX_LENGTH,
  USERNAME_REGEX,
} from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { AlertCircle, CheckCircle2, Globe } from 'lucide-react-native';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import {
  EOptionRow,
  ESectionFooter,
  ESectionLabel,
  ESettingsGroup,
  EToggleRow,
} from '../../../components/ui/editorial';
import { useHydratedFormState } from '../../../hooks/use-hydrated-form-state';
import { AnalyticsEvent, trackEvent } from '../../../lib/analytics';
import { gqlFetcher } from '../../../lib/graphql-client';
import { userFriendlyError } from '../../../lib/graphql-errors';
import { queryKeys } from '../../../lib/query-keys';
import { meOptions } from '../../../lib/query-options';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { GUTTER, radius, readableWidth, space, type } from '../../../theme/type';
import { triggerImpact, triggerNotification } from '../../../utils/haptics';

/* ─── Riding profile options ─── */

const EXPERIENCE_LEVELS = [
  { key: ExperienceLevel.BEGINNER, labelKey: 'settings.experienceBeginner' },
  { key: ExperienceLevel.INTERMEDIATE, labelKey: 'settings.experienceIntermediate' },
  { key: ExperienceLevel.ADVANCED, labelKey: 'settings.experienceAdvanced' },
] as const;

const RIDING_GOALS = [
  { key: RidingGoal.TRACK_RIDES, labelKey: 'settings.goalTrackRides' },
  { key: RidingGoal.MANAGE_EXPENSES, labelKey: 'settings.goalManageExpenses' },
  { key: RidingGoal.DISCOVER_ROUTES, labelKey: 'settings.goalDiscoverRoutes' },
  { key: RidingGoal.MAINTAIN_BIKE, labelKey: 'settings.goalMaintainBike' },
  { key: RidingGoal.JUST_EXPLORING, labelKey: 'settings.goalJustExploring' },
] as const;

const USERNAME_DEBOUNCE_MS = 500;
/** The server's own rules (format and reserved names), so the inline check agrees with save. */
const RESERVED_USERNAME_SET: ReadonlySet<string> = new Set(RESERVED_USERNAMES);
function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username) && !RESERVED_USERNAME_SET.has(username);
}

const USERNAME_STATUS = {
  IDLE: 'idle',
  VALID: 'valid',
  INVALID: 'invalid',
} as const;
type UsernameStatus = (typeof USERNAME_STATUS)[keyof typeof USERNAME_STATUS];

type FormValues = {
  publicUsername: string;
  displayName: string;
  bio: string;
  city: string;
  isPublic: boolean;
  fullName: string;
  experienceLevel: ExperienceLevel;
  ridingGoals: string[];
};

type UserPreferences = { experienceLevel?: string; ridingGoals?: string[] };

const PUBLIC_FIELDS = ['publicUsername', 'displayName', 'bio', 'city', 'isPublic'] as const;

function sameGoals(a: string[], b: string[]) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** A labelled text field inside an inset group. */
function FieldRow({
  label,
  children,
  isLast,
  trailing,
}: {
  label: string;
  children: ReactNode;
  isLast?: boolean;
  trailing?: ReactNode;
}) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        paddingHorizontal: space.md,
        paddingTop: space.sm,
        paddingBottom: space.xs,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: t.line,
      }}
    >
      <Text style={[type.caption, { color: t.ink3 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36 }}>
        {children}
        {trailing}
      </View>
    </View>
  );
}

/**
 * Edit profile — the one place a rider edits who they are: the public profile
 * other riders see, and the private riding profile (name, experience, goals)
 * that tunes the app. Saved together from the header.
 */
export default function EditProfileScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation();

  const meQuery = useQuery(meOptions());
  const user = meQuery.data?.me;

  const [initial, setInitial] = useState<FormValues | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [leaveAfterSave, setLeaveAfterSave] = useState(false);

  useHydratedFormState(user, (u) => {
    const prefs = u.preferences as UserPreferences | null | undefined;
    const values: FormValues = {
      publicUsername: u.publicUsername ?? '',
      displayName: u.displayName ?? '',
      bio: u.bio ?? '',
      city: u.city ?? '',
      isPublic: u.isPublic ?? false,
      fullName: u.fullName ?? '',
      experienceLevel: (prefs?.experienceLevel as ExperienceLevel) ?? ExperienceLevel.BEGINNER,
      ridingGoals: prefs?.ridingGoals ?? [],
    };
    setInitial(values);
    setForm(values);
  });

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const changes = useMemo(() => {
    if (!form || !initial) return { publicInput: {}, userInput: {}, ridingChanged: false };
    const publicInput: Partial<Pick<FormValues, (typeof PUBLIC_FIELDS)[number]>> = {};
    for (const field of PUBLIC_FIELDS) {
      if (form[field] !== initial[field]) Object.assign(publicInput, { [field]: form[field] });
    }
    const userInput: { fullName?: string; preferences?: Record<string, unknown> } = {};
    const trimmedName = form.fullName.trim();
    if (trimmedName && trimmedName !== initial.fullName.trim()) userInput.fullName = trimmedName;
    const ridingChanged =
      form.experienceLevel !== initial.experienceLevel ||
      !sameGoals(form.ridingGoals, initial.ridingGoals);
    if (ridingChanged) {
      userInput.preferences = {
        experienceLevel: form.experienceLevel,
        ridingGoals: form.ridingGoals,
      };
    }
    return { publicInput, userInput, ridingChanged };
  }, [form, initial]);

  const isDirty =
    Object.keys(changes.publicInput).length > 0 || Object.keys(changes.userInput).length > 0;

  // Username format check (debounced). Uniqueness is enforced by the server on save.
  const debouncedUsername = useDebounce(form?.publicUsername ?? '', USERNAME_DEBOUNCE_MS);
  const usernameStatus: UsernameStatus =
    !debouncedUsername || debouncedUsername === initial?.publicUsername
      ? USERNAME_STATUS.IDLE
      : isValidUsername(debouncedUsername)
        ? USERNAME_STATUS.VALID
        : USERNAME_STATUS.INVALID;

  // The public profile and the account (name, riding profile) are two
  // mutations with no shared transaction. Run both and handle each result, so
  // a half-saved profile is reported as such and the half that landed becomes
  // the new baseline instead of looking unsaved.
  const saveMutation = useMutation({
    mutationFn: async () => {
      const hasPublic = Object.keys(changes.publicInput).length > 0;
      const hasUser = Object.keys(changes.userInput).length > 0;
      const [publicResult, userResult] = await Promise.allSettled([
        hasPublic ? gqlFetcher(UpdateMyProfileDocument, { input: changes.publicInput }) : null,
        hasUser ? gqlFetcher(UpdateUserDocument, { input: changes.userInput }) : null,
      ]);
      const publicSaved = hasPublic && publicResult.status === 'fulfilled';
      const userSaved = hasUser && userResult.status === 'fulfilled';
      const failure = [publicResult, userResult].find((r) => r.status === 'rejected');
      if (failure && !publicSaved && !userSaved) throw failure.reason;
      return { publicSaved, userSaved, failure: failure?.reason as unknown };
    },
    onSuccess: ({ publicSaved, userSaved, failure }) => {
      if (!form || !initial) return;
      if (publicSaved) trackEvent(AnalyticsEvent.PROFILE_EDITED);
      if (userSaved) {
        trackEvent(AnalyticsEvent.SETTINGS_CHANGED, {
          experience_level: form.experienceLevel,
          goals_count: form.ridingGoals.length,
        });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });

      // The new baseline is what the server now holds: saved parts take the
      // form's values (the name trimmed, as sent), failed parts keep the old.
      const baseline: FormValues = { ...initial };
      if (publicSaved) {
        for (const field of PUBLIC_FIELDS) Object.assign(baseline, { [field]: form[field] });
      }
      if (userSaved) {
        baseline.fullName = changes.userInput.fullName ?? initial.fullName;
        baseline.experienceLevel = form.experienceLevel;
        baseline.ridingGoals = form.ridingGoals;
      }
      setInitial(baseline);

      if (failure) {
        triggerNotification(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          t('community.partialSaveTitle'),
          t(
            publicSaved ? 'community.partialSavePublicSaved' : 'community.partialSaveAccountSaved',
            {
              error: userFriendlyError(failure),
            },
          ),
        );
        return;
      }
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      // A trailing space in the name is not a change once saved.
      setForm({ ...form, fullName: form.fullName.trim() });
      setLeaveAfterSave(true);
    },
    onError: (error) => {
      Alert.alert(t('common.error'), userFriendlyError(error));
    },
  });

  // Leave once the saved values are the new baseline, so the unsaved-changes
  // guard below no longer holds the screen.
  useEffect(() => {
    if (leaveAfterSave && !isDirty) router.back();
  }, [leaveAfterSave, isDirty]);

  usePreventRemove(isDirty && !saveMutation.isPending, ({ data }) => {
    Alert.alert(t('community.unsavedChanges'), t('community.unsavedChangesDesc'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.discard'),
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  const handleSave = () => {
    if (!form || saveMutation.isPending) return;
    triggerImpact();
    if (form.isPublic && !form.publicUsername.trim()) {
      Alert.alert(t('community.usernameRequired'), t('community.usernameRequiredDesc'));
      return;
    }
    saveMutation.mutate();
  };

  const canSave = isDirty && !saveMutation.isPending;
  const inputStyle = [type.body, { flex: 1, color: theme.ink, paddingVertical: space.xs }];

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            saveMutation.isPending ? (
              <ActivityIndicator size="small" color={theme.ink3} />
            ) : (
              <Pressable
                testID="edit-profile-save"
                onPress={handleSave}
                disabled={!canSave}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSave }}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xxs }}
              >
                <Text style={[type.bodyStrong, { color: canSave ? theme.warm : theme.ink4 }]}>
                  {t('common.save')}
                </Text>
              </Pressable>
            ),
        }}
      />
      <KeyboardAwareScrollView
        testID="edit-profile-screen"
        bottomOffset={space.xl}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{
          ...readableWidth,
          paddingHorizontal: GUTTER,
          paddingTop: space.md,
          paddingBottom: space.xxxl,
          gap: space.xl,
        }}
      >
        {!form ? (
          <ActivityIndicator style={{ marginTop: space.xxl }} color={theme.ink3} />
        ) : (
          <>
            {/* ─── Riding profile (private) ─── */}
            <View>
              <ESectionLabel label={t('profile.ridingProfile')} />
              <ESettingsGroup>
                <FieldRow label={t('profile.nameLabel')} isLast>
                  <TextInput
                    testID="edit-profile-full-name"
                    value={form.fullName}
                    onChangeText={(text) => set('fullName', text)}
                    placeholder={t('settings.fullNamePlaceholder')}
                    placeholderTextColor={theme.ink4}
                    autoCapitalize="words"
                    autoCorrect={false}
                    accessibilityLabel={t('profile.nameLabel')}
                    style={inputStyle}
                  />
                </FieldRow>
              </ESettingsGroup>
              <ESectionFooter>{t('profile.ridingProfileFooter')}</ESectionFooter>
            </View>

            <View>
              <ESectionLabel label={t('settings.experienceLevelLabel')} />
              <ESettingsGroup>
                {EXPERIENCE_LEVELS.map((level) => (
                  <EOptionRow
                    key={level.key}
                    testID={`edit-profile-experience-${level.key}`}
                    title={t(level.labelKey)}
                    selected={form.experienceLevel === level.key}
                    onPress={() => set('experienceLevel', level.key)}
                  />
                ))}
              </ESettingsGroup>
            </View>

            <View>
              <ESectionLabel label={t('settings.ridingGoalsLabel')} />
              <ESettingsGroup>
                {RIDING_GOALS.map((goal) => {
                  const selected = form.ridingGoals.includes(goal.key);
                  return (
                    <EOptionRow
                      key={goal.key}
                      multiple
                      testID={`edit-profile-goal-${goal.key}`}
                      title={t(goal.labelKey)}
                      selected={selected}
                      onPress={() =>
                        set(
                          'ridingGoals',
                          selected
                            ? form.ridingGoals.filter((g) => g !== goal.key)
                            : [...form.ridingGoals, goal.key],
                        )
                      }
                    />
                  );
                })}
              </ESettingsGroup>
            </View>

            {/* ─── Public profile ─── */}
            <View>
              <ESectionLabel label={t('community.publicProfile')} />
              <ESettingsGroup>
                <EToggleRow
                  testID="edit-profile-public"
                  icon={Globe}
                  title={t('community.makePublic')}
                  subtitle={t('community.publicProfileDesc')}
                  value={form.isPublic}
                  onValueChange={(value) => set('isPublic', value)}
                />
                <FieldRow
                  label={t('community.username')}
                  trailing={
                    usernameStatus === USERNAME_STATUS.VALID ? (
                      <CheckCircle2 size={18} color={theme.success} strokeWidth={2} />
                    ) : usernameStatus === USERNAME_STATUS.INVALID ? (
                      <AlertCircle size={18} color={theme.danger} strokeWidth={2} />
                    ) : null
                  }
                >
                  <Text style={[type.body, { color: theme.ink3 }]}>@</Text>
                  <TextInput
                    testID="edit-profile-username"
                    value={form.publicUsername}
                    onChangeText={(text) =>
                      set('publicUsername', text.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder={t('community.usernamePlaceholder')}
                    placeholderTextColor={theme.ink4}
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={USERNAME_MAX_LENGTH}
                    accessibilityLabel={t('community.username')}
                    style={inputStyle}
                  />
                </FieldRow>
                <FieldRow label={t('profile.publicNameLabel')}>
                  <TextInput
                    value={form.displayName}
                    onChangeText={(text) => set('displayName', text)}
                    placeholder={t('community.displayNamePlaceholder')}
                    placeholderTextColor={theme.ink4}
                    maxLength={DISPLAY_NAME_MAX_LENGTH}
                    accessibilityLabel={t('profile.publicNameLabel')}
                    style={inputStyle}
                  />
                </FieldRow>
                <FieldRow
                  label={t('community.bio')}
                  trailing={
                    <Text style={[type.caption, { color: theme.ink4, alignSelf: 'flex-end' }]}>
                      {form.bio.length}/{BIO_MAX_LENGTH}
                    </Text>
                  }
                >
                  <TextInput
                    value={form.bio}
                    onChangeText={(text) => set('bio', text)}
                    placeholder={t('community.bioPlaceholder')}
                    placeholderTextColor={theme.ink4}
                    multiline
                    maxLength={BIO_MAX_LENGTH}
                    accessibilityLabel={t('community.bio')}
                    style={[...inputStyle, { minHeight: 72, textAlignVertical: 'top' }]}
                  />
                </FieldRow>
                <FieldRow label={t('community.city')} isLast>
                  <TextInput
                    value={form.city}
                    onChangeText={(text) => set('city', text)}
                    placeholder={t('community.cityPlaceholder')}
                    placeholderTextColor={theme.ink4}
                    maxLength={CITY_MAX_LENGTH}
                    accessibilityLabel={t('community.city')}
                    style={inputStyle}
                  />
                </FieldRow>
              </ESettingsGroup>
              {usernameStatus === USERNAME_STATUS.INVALID ? (
                <Text
                  style={[
                    type.caption,
                    { color: theme.danger, marginTop: space.xs, marginHorizontal: space.md },
                  ]}
                >
                  {t('community.usernameInvalid')}
                </Text>
              ) : null}
            </View>

            {saveMutation.isError ? (
              <View
                style={{
                  padding: space.sm,
                  borderRadius: radius.control,
                  borderCurve: 'continuous',
                  backgroundColor: tint(theme.danger, 0.12),
                }}
              >
                <Text style={[type.subhead, { color: theme.danger }]}>
                  {t('settings.saveError')}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}
