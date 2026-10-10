import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  ESectionFooter,
  ESectionLabel,
  ESettingsGroup,
  ESettingsRow,
} from '@/components/ui/editorial';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { GUTTER, readableWidth, space, type } from '@/theme/type';
import { triggerImpact, triggerSelection } from '@/utils/haptics';

const SUPPORT_EMAIL = 'support@motovault.app';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=MotoVault Support`;
const ROW_MIN_HEIGHT = process.env.EXPO_OS === 'android' ? 48 : 44;

const FAQ_ITEMS = [
  {
    questionKey: 'support.faq1Question',
    answerKey: 'support.faq1Answer',
    defaultQuestion: 'How do I add a motorcycle?',
    defaultAnswer:
      'Go to the Garage tab and tap the + button. You can search for your motorcycle by make, model, and year.',
  },
  {
    questionKey: 'support.faq2Question',
    answerKey: 'support.faq2Answer',
    defaultQuestion: 'How does diagnostics work?',
    defaultAnswer:
      'Describe your motorcycle symptoms in the Diagnose tab. Our AI analyzes common issues and provides likely causes with recommended actions.',
  },
  {
    questionKey: 'support.faq3Question',
    answerKey: 'support.faq3Answer',
    defaultQuestion: 'Can I have multiple motorcycles?',
    defaultAnswer:
      'Yes! You can add as many motorcycles as you want. Set one as your primary bike for personalized recommendations.',
  },
  {
    questionKey: 'support.faq4Question',
    answerKey: 'support.faq4Answer',
    defaultQuestion: 'How do I change my language?',
    defaultAnswer: 'Go to Profile → App settings → Language and pick the language you want.',
  },
  {
    questionKey: 'support.faq5Question',
    answerKey: 'support.faq5Answer',
    defaultQuestion: 'Is my data secure?',
    defaultAnswer:
      'Yes. We use end-to-end encryption and follow industry best practices. You can export or delete your data at any time from Privacy settings.',
  },
] as const;

/** Expandable FAQ row — same shape as an inset grouped settings row. */
function FAQRow({
  question,
  answer,
  isLast,
}: {
  question: string;
  answer: string;
  /** Set by `ESettingsGroup`. */
  isLast?: boolean;
}) {
  const { t } = useEditorialTheme();
  const [expanded, setExpanded] = useState(false);
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <Pressable
      onPress={() => {
        triggerSelection();
        setExpanded((prev) => !prev);
      }}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      android_ripple={{ color: tint(t.ink, 0.08) }}
      style={({ pressed }) => ({
        backgroundColor:
          pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, 0.06) : 'transparent',
      })}
    >
      <View
        style={{
          marginLeft: space.md,
          paddingRight: space.md,
          paddingVertical: space.sm,
          minHeight: ROW_MIN_HEIGHT,
          justifyContent: 'center',
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: t.line,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Text style={[type.body, { flex: 1, color: t.ink }]}>{question}</Text>
          <Chevron size={17} color={t.ink4} strokeWidth={2} />
        </View>
        {expanded ? (
          <Text style={[type.subhead, { color: t.ink2, marginTop: space.xs }]}>{answer}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function SupportScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  const handleContactSupport = useCallback(() => {
    triggerImpact();
    Linking.openURL(SUPPORT_MAILTO);
  }, []);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView
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
      <Animated.View entering={FadeInUp.duration(250)}>
        <ESectionLabel label={t('support.faq', { defaultValue: 'FAQ' })} />
        <ESettingsGroup>
          {FAQ_ITEMS.map((item) => (
            <FAQRow
              key={item.questionKey}
              question={t(item.questionKey, { defaultValue: item.defaultQuestion })}
              answer={t(item.answerKey, { defaultValue: item.defaultAnswer })}
            />
          ))}
        </ESettingsGroup>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(50).duration(250)}>
        <ESectionLabel label={t('support.contact', { defaultValue: 'Contact Us' })} />
        <ESettingsGroup>
          <ESettingsRow
            icon={Mail}
            title={t('support.emailSupport', { defaultValue: 'Email Support' })}
            subtitle={SUPPORT_EMAIL}
            onPress={handleContactSupport}
            testID="support-email"
          />
        </ESettingsGroup>
        <ESectionFooter>
          {`MotoVault · ${t('support.version', { version: appVersion, defaultValue: `Version ${appVersion}` })}`}
        </ESectionFooter>
      </Animated.View>
    </ScrollView>
  );
}
