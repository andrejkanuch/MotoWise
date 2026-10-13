import { Mail, MessageSquare } from 'lucide-react-native';
import { PostHogMaskView } from 'posthog-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import {
  ESectionFooter,
  ESectionLabel,
  ESettingsGroup,
  ESettingsRow,
  EToggleRow,
} from '@/components/ui/editorial';
import { useEditorialTheme } from '@/theme/editorial';
import { space, type } from '@/theme/type';
import { isRelayEmail } from './contact-email';
import { ContactEmailSheet } from './contact-email-sheet';
import { useFeedbackContactPreference } from './use-feedback-contact-preference';

/**
 * Notifications' "Talk to the developer" group: the contact opt-in toggle and,
 * while it is on, the email to reach the rider at. The address is rider data,
 * so it renders inside a PostHog mask.
 */
export function FeedbackContactGroup() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const contact = useFeedbackContactPreference();
  const [error, setError] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const shownEmail =
    contact.email ??
    (isRelayEmail(contact.accountEmail)
      ? t('feedback.notificationsEmailRelay')
      : (contact.accountEmail ?? ''));

  return (
    <View>
      <ESectionLabel label={t('feedback.notificationsSection')} />
      <ESettingsGroup>
        <EToggleRow
          testID="notifications-feedback-contact"
          icon={MessageSquare}
          title={t('feedback.contactOptIn')}
          subtitle={t('feedback.notificationsOptInSubtitle')}
          value={contact.enabled}
          disabled={!contact.isLoaded}
          onValueChange={(value) => {
            setError(false);
            void contact.setEnabled(value).then((ok) => setError(!ok));
          }}
        />
        {contact.enabled ? (
          <ESettingsRow
            testID="notifications-feedback-email"
            icon={Mail}
            title={t('feedback.contactEmailLabel')}
            accessibilityLabel={t('feedback.contactEmailLabel')}
            accessory={
              <PostHogMaskView style={{ maxWidth: '50%' }}>
                <Text numberOfLines={1} style={[type.body, { color: theme.ink3 }]}>
                  {shownEmail}
                </Text>
              </PostHogMaskView>
            }
            onPress={() => setSheetOpen(true)}
          />
        ) : null}
      </ESettingsGroup>
      {error ? (
        <Text
          testID="notifications-feedback-error"
          accessibilityLiveRegion="polite"
          style={[type.caption, { color: theme.danger, marginTop: space.xs, marginLeft: space.md }]}
        >
          {t('feedback.saveError')}
        </Text>
      ) : (
        <ESectionFooter>{t('feedback.contactEmailHelper')}</ESectionFooter>
      )}
      <ContactEmailSheet
        visible={sheetOpen}
        accountEmail={contact.accountEmail}
        storedEmail={contact.email}
        onSave={contact.setEmail}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
