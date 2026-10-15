import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, Text, TextInput, View } from 'react-native';
import { ESectionFooter, ESettingsGroup } from '@/components/ui/editorial';
import {
  SHEET_CONTENT_STYLE,
  SHEET_PRIMARY_STATE,
  SheetFooter,
  SheetTitle,
} from '@/components/ui/sheet-form';
import { useEditorialTheme } from '@/theme/editorial';
import { space, type } from '@/theme/type';
import { initialContactEmailField, isRelayEmail, parseContactEmailField } from './contact-email';

const SHEET_ERROR = {
  INVALID: 'invalid',
  SAVE_FAILED: 'save_failed',
} as const;
type SheetError = (typeof SHEET_ERROR)[keyof typeof SHEET_ERROR];

const SHEET_ERROR_KEY = {
  [SHEET_ERROR.INVALID]: 'feedback.emailInvalid',
  [SHEET_ERROR.SAVE_FAILED]: 'feedback.saveError',
} as const satisfies Record<SheetError, string>;

/**
 * Small sheet that edits "Email to reach me at". Clearing the field saves
 * `null` (use the account email). It stays open on an invalid address or a
 * failed save.
 */
export function ContactEmailSheet({
  visible,
  accountEmail,
  storedEmail,
  onSave,
  onClose,
}: {
  visible: boolean;
  accountEmail: string | null;
  storedEmail: string | null;
  onSave: (email: string | null) => Promise<boolean>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const [value, setValue] = useState('');
  const [error, setError] = useState<SheetError | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts from what is saved now.
  useEffect(() => {
    if (!visible) return;
    setValue(initialContactEmailField(accountEmail, storedEmail));
    setError(null);
  }, [visible, accountEmail, storedEmail]);

  const handleSave = async () => {
    const parsed = parseContactEmailField(value, accountEmail);
    if (!parsed.ok) {
      setError(SHEET_ERROR.INVALID);
      return;
    }
    setSaving(true);
    const ok = await onSave(parsed.email);
    setSaving(false);
    if (!ok) {
      setError(SHEET_ERROR.SAVE_FAILED);
      return;
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={SHEET_CONTENT_STYLE}>
          <SheetTitle>{t('feedback.contactEmailLabel')}</SheetTitle>
          <View>
            <ESettingsGroup>
              <TextInput
                testID="contact-email-input"
                value={value}
                onChangeText={(text) => {
                  setValue(text);
                  setError(null);
                }}
                placeholder={t('feedback.contactEmailPlaceholder')}
                placeholderTextColor={theme.ink4}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                autoFocus
                accessibilityLabel={t('feedback.contactEmailLabel')}
                style={[
                  type.body,
                  { color: theme.ink, minHeight: 48, paddingHorizontal: space.md },
                ]}
              />
            </ESettingsGroup>
            {error ? (
              <Text
                testID="contact-email-error"
                accessibilityLiveRegion="polite"
                style={[
                  type.caption,
                  { color: theme.danger, marginTop: space.xs, marginHorizontal: space.md },
                ]}
              >
                {t(SHEET_ERROR_KEY[error])}
              </Text>
            ) : (
              <ESectionFooter>
                {isRelayEmail(accountEmail)
                  ? t('feedback.contactEmailRelayHelper')
                  : t('feedback.contactEmailHelper')}
              </ESectionFooter>
            )}
          </View>
        </View>
        <View style={{ flex: 1 }} />
        {saving ? (
          <ActivityIndicator color={theme.ink3} style={{ marginBottom: space.sm }} />
        ) : null}
        <SheetFooter
          primaryLabel={t('common.save')}
          primaryTestID="contact-email-save"
          onPrimary={() => void handleSave()}
          primaryState={saving ? SHEET_PRIMARY_STATE.DISABLED : SHEET_PRIMARY_STATE.READY}
          onCancel={onClose}
          cancelDisabled={saving}
        />
      </View>
    </Modal>
  );
}
