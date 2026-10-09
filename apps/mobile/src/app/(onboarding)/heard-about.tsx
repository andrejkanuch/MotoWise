import { NotificationFeedbackType } from 'expo-haptics';
import {
  Facebook,
  Globe,
  HelpCircle,
  Instagram,
  MessagesSquare,
  MoreHorizontal,
  Music2,
  Newspaper,
  Search,
  Sparkles,
  Users,
  Youtube,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useOnboardingColors } from '../../components/onboarding/onboarding-colors';
import { OnboardingOptionList } from '../../components/onboarding/onboarding-option-list';
import { OnboardingShell } from '../../components/onboarding/onboarding-shell';
import { OB_SCREEN } from '../../config/onboarding';
import { useOnboardingNext } from '../../hooks/use-onboarding-flow';
import { AnalyticsEvent, setUserPropertiesOnce } from '../../lib/analytics';
import { trackOnboardingEvent } from '../../lib/onboarding-analytics';
import { setSelfReportedSource } from '../../lib/subscription';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { radius, space, type } from '../../theme/type';
import { triggerNotification } from '../../utils/haptics';

/**
 * Acquisition-channel options. `id` is the raw value sent to analytics / RevenueCat
 * (never displayed); `labelKey` resolves to localized copy. Order is fixed (not
 * randomized) — at this volume self-report is directional, and `app_store_search`
 * + `dont_remember` are included to soften forced-attribution bias.
 */
const HEARD_ABOUT_OPTIONS = [
  { id: 'tiktok', labelKey: 'heardAboutTiktok', icon: Music2 },
  { id: 'instagram', labelKey: 'heardAboutInstagram', icon: Instagram },
  { id: 'facebook', labelKey: 'heardAboutFacebook', icon: Facebook },
  { id: 'youtube', labelKey: 'heardAboutYoutube', icon: Youtube },
  { id: 'reddit', labelKey: 'heardAboutReddit', icon: MessagesSquare },
  { id: 'friend', labelKey: 'heardAboutFriend', icon: Users },
  { id: 'app_store_search', labelKey: 'heardAboutAppStore', icon: Search },
  { id: 'google_search', labelKey: 'heardAboutGoogle', icon: Globe },
  // Web→app cohort self-report (P2/T5) — the MotoVault site/blog is now a
  // meaningful acquisition source distinct from a generic Google search.
  { id: 'website', labelKey: 'heardAboutWebsite', icon: Newspaper },
  { id: 'ai_chat', labelKey: 'heardAboutAi', icon: Sparkles },
  { id: 'dont_remember', labelKey: 'heardAboutDontRemember', icon: HelpCircle },
  { id: 'other', labelKey: 'heardAboutOther', icon: MoreHorizontal },
] as const;

type HeardAboutId = (typeof HEARD_ABOUT_OPTIONS)[number]['id'];

/** The option that opens a free-text answer instead of advancing on tap. */
const OTHER_OPTION: HeardAboutId = 'other';

/** Longest free-text "other" answer kept — a channel name, not an essay. */
const OTHER_TEXT_MAX_LENGTH = 80;

const ADVANCE_DELAY_MS = 600;

export default function HeardAboutScreen() {
  const oc = useOnboardingColors();
  const { t } = useTranslation();
  const goNext = useOnboardingNext(OB_SCREEN.HEARD_ABOUT);
  const setHeardFrom = useOnboardingStore((s) => s.setHeardFrom);
  const setLastCompletedScreen = useOnboardingStore((s) => s.setLastCompletedScreen);

  const [pending, setPending] = useState<HeardAboutId | null>(null);
  const [otherText, setOtherText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Synchronous one-shot guard: `pending` is React state read from the render
  // closure, so two taps in the same frame (option+option, or option+skip) would
  // both see it null and double-fire. A ref settles immediately.
  const advancedRef = useRef(false);

  useEffect(() => {
    trackOnboardingEvent(AnalyticsEvent.ONBOARDING_STEP_VIEWED, OB_SCREEN.HEARD_ABOUT);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Record the answer and advance. `other` carries the rider's own words as
   * `heard_from_other`, so channels missing from the list (a forum, a dealer,
   * a podcast) surface instead of collapsing into one bucket.
   */
  const commit = (id: HeardAboutId, detail?: string) => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    triggerNotification(NotificationFeedbackType.Success);
    setPending(id);
    setHeardFrom(id);
    setLastCompletedScreen(OB_SCREEN.HEARD_ABOUT);
    trackOnboardingEvent(AnalyticsEvent.REFERRAL_SOURCE_SELECTED, OB_SCREEN.HEARD_ABOUT, {
      referral_source: id,
      ...(detail ? { referral_source_other: detail } : {}),
    });
    // Fire-and-forget — do not block navigation on these writes (KTD-10/KTD-2).
    setUserPropertiesOnce({ heard_from: id, ...(detail ? { heard_from_other: detail } : {}) });
    void setSelfReportedSource(id);
    timerRef.current = setTimeout(goNext, ADVANCE_DELAY_MS);
  };

  const handleSelect = (id: HeardAboutId) => {
    if (advancedRef.current) return;
    // "Other" opens a text field rather than advancing; Continue commits it.
    if (id === OTHER_OPTION) {
      setPending(OTHER_OPTION);
      return;
    }
    commit(id);
  };

  const handleOtherContinue = () => {
    const detail = otherText.trim().slice(0, OTHER_TEXT_MAX_LENGTH);
    commit(OTHER_OPTION, detail || undefined);
  };

  const otherOpen = pending === OTHER_OPTION && !advancedRef.current;

  // Skip advances without recording a source — `heard_from` stays unset (KTD-10),
  // but we DO emit a skip event so the skip rate is measurable (MOT-272). A high
  // skip rate signals the screen's placement may need to move earlier.
  const handleSkip = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    setLastCompletedScreen(OB_SCREEN.HEARD_ABOUT);
    trackOnboardingEvent(AnalyticsEvent.REFERRAL_SOURCE_SKIPPED, OB_SCREEN.HEARD_ABOUT);
    goNext();
  };

  return (
    <OnboardingShell
      screen={OB_SCREEN.HEARD_ABOUT}
      title={t('onboarding.heardAboutHeadline')}
      subtitle={t('onboarding.heardAboutSubtitle')}
      primary={
        otherOpen
          ? { label: t('onboarding.heardAboutOtherContinue'), onPress: handleOtherContinue }
          : undefined
      }
      secondary={{ label: t('onboarding.heardAboutSkip'), onPress: handleSkip }}
    >
      <OnboardingOptionList
        options={HEARD_ABOUT_OPTIONS.map((option) => ({
          key: option.id,
          label: t(`onboarding.${option.labelKey}`),
          icon: option.icon,
        }))}
        isSelected={(id) => pending === id}
        onSelect={handleSelect}
      />
      {otherOpen ? (
        <Animated.View entering={FadeInUp.duration(240)} style={{ marginTop: space.sm }}>
          <TextInput
            value={otherText}
            onChangeText={setOtherText}
            placeholder={t('onboarding.heardAboutOtherPlaceholder')}
            placeholderTextColor={oc.textMuted}
            maxLength={OTHER_TEXT_MAX_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleOtherContinue}
            accessibilityLabel={t('onboarding.heardAboutOtherPlaceholder')}
            style={{
              ...type.body,
              minHeight: 52,
              backgroundColor: oc.surface,
              borderRadius: radius.control,
              borderCurve: 'continuous',
              paddingHorizontal: space.md,
              paddingVertical: space.sm,
              color: oc.textPrimary,
            }}
          />
        </Animated.View>
      ) : null}
    </OnboardingShell>
  );
}
