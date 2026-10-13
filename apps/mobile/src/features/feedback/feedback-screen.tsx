import { FEEDBACK_CONTACT_SOURCE, type FeedbackQuickPick } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ESectionFooter, ESectionLabel, ESettingsGroup } from '@/components/ui/editorial';
import { useHydratedFormState } from '@/hooks/use-hydrated-form-state';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { GRAPHQL_ERROR_CODE } from '@/lib/graphql-error-classification';
import { hasGraphQLCode } from '@/lib/graphql-errors';
import { meOptions } from '@/lib/query-options';
import { tabBarBottomOffset, useTabBarStore } from '@/stores/tab-bar.store';
import { useEditorialTheme } from '@/theme/editorial';
import { GUTTER, radius, readableWidth, SYSTEM_WEIGHT, space, type } from '@/theme/type';
import { triggerImpact, triggerNotification } from '@/utils/haptics';
import { ContactCheckbox } from './contact-checkbox';
import {
  initialContactEmailField,
  isRelayEmail,
  parseContactEmailField,
  readFeedbackContact,
} from './contact-email';
import { currentAppVersion, DEVICE_PLATFORM_LABEL, devicePlatform } from './feedback-input';
import { QuickPickChips } from './quick-pick-chips';
import { useSendFeedback } from './use-send-feedback';

/** Room for the floating tab bar when its height is not measured yet. */
const TAB_BAR_FALLBACK_HEIGHT = 64;
const MESSAGE_MIN_HEIGHT = 140;

const SEND_ERROR = {
  THROTTLED: 'throttled',
  GENERIC: 'generic',
} as const;
type SendError = (typeof SEND_ERROR)[keyof typeof SEND_ERROR];

const SEND_ERROR_KEY = {
  [SEND_ERROR.THROTTLED]: 'feedback.errorThrottled',
  [SEND_ERROR.GENERIC]: 'feedback.errorGeneric',
} as const satisfies Record<SendError, string>;

/**
 * "Write to the developer": an optional quick pick, a free-text message and
 * the contact opt-in. Text, quick pick and the draft's `clientId` survive a
 * failed send; a confirmed send swaps in a thank-you with a Done button.
 */
export function FeedbackScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarStore((s) => s.height) ?? TAB_BAR_FALLBACK_HEIGHT;

  const meQuery = useQuery(meOptions());
  const me = meQuery.data?.me;
  const accountEmail = me?.email ?? null;
  const storedContact = readFeedbackContact(me?.preferences);

  const [clientId, setClientId] = useState(() => Crypto.randomUUID());
  const [quickPick, setQuickPick] = useState<FeedbackQuickPick | null>(null);
  const [message, setMessage] = useState('');
  const [contactOptIn, setContactOptIn] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [sendError, setSendError] = useState<SendError | null>(null);
  const [sent, setSent] = useState(false);

  useHydratedFormState(me, (user) => {
    const stored = readFeedbackContact(user.preferences);
    setContactOptIn(stored?.enabled ?? false);
    setContactEmail(initialContactEmailField(user.email, stored?.email));
  });

  const sendMutation = useSendFeedback();
  const canSend = message.trim().length > 0 && !sendMutation.isPending;

  const handleSend = () => {
    if (!canSend) return;
    const parsedEmail = contactOptIn ? parseContactEmailField(contactEmail, accountEmail) : null;
    if (parsedEmail && !parsedEmail.ok) {
      setEmailInvalid(true);
      return;
    }
    triggerImpact();
    setSendError(null);
    sendMutation.mutate(
      {
        clientId,
        message,
        quickPick,
        contactOptIn,
        contactEmail: parsedEmail?.ok ? parsedEmail.email : null,
      },
      {
        onSuccess: () => {
          triggerNotification(Haptics.NotificationFeedbackType.Success);
          trackEvent(AnalyticsEvent.FEEDBACK_SENT, {
            quick_pick: quickPick,
            contact_opt_in: contactOptIn,
          });
          if (contactOptIn !== (storedContact?.enabled ?? false)) {
            trackEvent(AnalyticsEvent.FEEDBACK_CONTACT_OPT_IN_CHANGED, {
              enabled: contactOptIn,
              source: FEEDBACK_CONTACT_SOURCE.FORM,
            });
          }
          setMessage('');
          setQuickPick(null);
          setClientId(Crypto.randomUUID());
          setSent(true);
        },
        onError: (error) => {
          triggerNotification(Haptics.NotificationFeedbackType.Error);
          setSendError(
            hasGraphQLCode(error, GRAPHQL_ERROR_CODE.TOO_MANY_REQUESTS)
              ? SEND_ERROR.THROTTLED
              : SEND_ERROR.GENERIC,
          );
        },
      },
    );
  };

  const bottomClearance = tabBarBottomOffset(insets.bottom) + tabBarHeight + space.lg;

  if (sent) {
    return <FeedbackSent bottomClearance={bottomClearance} />;
  }

  const appVersion = currentAppVersion();
  const relayAccount = isRelayEmail(accountEmail);
  const inputStyle = [type.body, { color: theme.ink, paddingHorizontal: space.md }];

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () =>
            sendMutation.isPending ? (
              <ActivityIndicator size="small" color={theme.ink3} />
            ) : (
              <Pressable
                testID="feedback-send"
                onPress={handleSend}
                disabled={!canSend}
                hitSlop={space.xs}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend }}
                style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs }}
              >
                <Text
                  style={[
                    type.body,
                    SYSTEM_WEIGHT.semibold,
                    { color: canSend ? theme.warm2 : theme.ink4 },
                  ]}
                >
                  {t('feedback.send')}
                </Text>
              </Pressable>
            ),
        }}
      />
      <KeyboardAwareScrollView
        testID="feedback-screen"
        bottomOffset={space.xl}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{
          ...readableWidth,
          paddingHorizontal: GUTTER,
          paddingTop: space.md,
          paddingBottom: bottomClearance,
          gap: space.xl,
        }}
      >
        <Animated.View entering={FadeInUp.duration(250)} style={{ gap: space.sm }}>
          <Text style={[type.subhead, { color: theme.ink2 }]}>{t('feedback.intro')}</Text>
          <QuickPickChips value={quickPick} onChange={setQuickPick} />
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(50).duration(250)}>
          <ESectionLabel label={t('feedback.messageLabel')} />
          <ESettingsGroup>
            <TextInput
              testID="feedback-message"
              value={message}
              onChangeText={setMessage}
              placeholder={t('feedback.messagePlaceholder')}
              placeholderTextColor={theme.ink4}
              multiline
              accessibilityLabel={t('feedback.messageLabel')}
              style={[
                ...inputStyle,
                { minHeight: MESSAGE_MIN_HEIGHT, paddingVertical: space.sm },
                { textAlignVertical: 'top' },
              ]}
            />
          </ESettingsGroup>
          <ESectionFooter>
            {t('feedback.context', {
              version: appVersion,
              platform: DEVICE_PLATFORM_LABEL[devicePlatform(process.env.EXPO_OS)],
            })}
          </ESectionFooter>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(250)}>
          <ESectionLabel label={t('feedback.contactLabel')} />
          <ESettingsGroup>
            <ContactCheckbox
              testID="feedback-contact-opt-in"
              label={t('feedback.contactOptIn')}
              checked={contactOptIn}
              onChange={(checked) => {
                setContactOptIn(checked);
                setEmailInvalid(false);
              }}
            />
            {contactOptIn ? (
              <View
                style={{
                  borderTopWidth: 0.5,
                  borderTopColor: theme.line,
                  paddingVertical: space.xs,
                }}
              >
                <Text style={[type.caption, { color: theme.ink3, paddingHorizontal: space.md }]}>
                  {t('feedback.contactEmailLabel')}
                </Text>
                <TextInput
                  testID="feedback-contact-email"
                  value={contactEmail}
                  onChangeText={(text) => {
                    setContactEmail(text);
                    setEmailInvalid(false);
                  }}
                  placeholder={t('feedback.contactEmailPlaceholder')}
                  placeholderTextColor={theme.ink4}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  accessibilityLabel={t('feedback.contactEmailLabel')}
                  style={[...inputStyle, { minHeight: 44, paddingVertical: space.xs }]}
                />
              </View>
            ) : null}
          </ESettingsGroup>
          {contactOptIn ? (
            <ESectionFooter>
              {relayAccount
                ? t('feedback.contactEmailRelayHelper')
                : t('feedback.contactEmailHelper')}
            </ESectionFooter>
          ) : null}
          {emailInvalid ? (
            <Text
              testID="feedback-email-error"
              accessibilityLiveRegion="polite"
              style={[
                type.caption,
                { color: theme.danger, marginTop: space.xs, marginLeft: space.md },
              ]}
            >
              {t('feedback.emailInvalid')}
            </Text>
          ) : null}
        </Animated.View>

        {sendError ? (
          <Animated.Text
            entering={FadeIn.duration(200)}
            testID="feedback-send-error"
            accessibilityLiveRegion="polite"
            style={[type.subhead, { color: theme.danger }]}
          >
            {t(SEND_ERROR_KEY[sendError])}
          </Animated.Text>
        ) : null}
      </KeyboardAwareScrollView>
    </>
  );
}

/** The confirmed-send state: a short thank-you and a Done back to where the rider came from. */
function FeedbackSent({ bottomClearance }: { bottomClearance: number }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  return (
    <Animated.View
      testID="feedback-sent"
      entering={FadeInUp.duration(250)}
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        justifyContent: 'center',
        paddingHorizontal: GUTTER,
        paddingBottom: bottomClearance,
        gap: space.md,
      }}
    >
      <Stack.Screen options={{ headerRight: () => null }} />
      <CircleCheck size={40} color={theme.success} strokeWidth={1.75} />
      <Text accessibilityRole="header" style={[type.sectionTitle, { color: theme.ink }]}>
        {t('feedback.sentTitle')}
      </Text>
      <Text style={[type.body, { color: theme.ink2 }]}>{t('feedback.sentBody')}</Text>
      <Pressable
        testID="feedback-done"
        onPress={() => {
          triggerImpact();
          router.back();
        }}
        accessibilityRole="button"
        style={({ pressed }) => ({
          marginTop: space.sm,
          height: 52,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: radius.control,
          borderCurve: 'continuous',
          backgroundColor: theme.warm,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={[type.bodyStrong, { color: theme.onWarm }]}>{t('common.done')}</Text>
      </Pressable>
    </Animated.View>
  );
}
