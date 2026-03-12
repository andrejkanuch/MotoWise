import { palette } from '@motovault/design-system';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp, Mail, MessageCircle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

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
    defaultAnswer:
      'Go to Profile and use the language selector to switch between English, Spanish, and German.',
  },
  {
    questionKey: 'support.faq5Question',
    answerKey: 'support.faq5Answer',
    defaultQuestion: 'Is my data secure?',
    defaultAnswer:
      'Yes. We use end-to-end encryption and follow industry best practices. You can export or delete your data at any time from Privacy settings.',
  },
];

function FAQItem({
  question,
  answer,
  isDark,
  isLast,
}: {
  question: string;
  answer: string;
  isDark: boolean;
  isLast?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      onPress={() => {
        haptic();
        setExpanded(!expanded);
      }}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: '600',
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {question}
        </Text>
        {expanded ? (
          <ChevronUp size={16} color={palette.neutral400} strokeWidth={2} />
        ) : (
          <ChevronDown size={16} color={palette.neutral400} strokeWidth={2} />
        )}
      </View>
      {expanded && (
        <Text
          style={{
            fontSize: 14,
            color: palette.neutral500,
            lineHeight: 20,
            marginTop: 8,
          }}
        >
          {answer}
        </Text>
      )}
    </Pressable>
  );
}

export default function SupportScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';

  const handleContactSupport = useCallback(() => {
    haptic();
    Linking.openURL('mailto:support@motovault.app?subject=MotoVault Support');
  }, []);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

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
          {t('support.title', { defaultValue: 'Help & Support' })}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* FAQ */}
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
            {t('support.faq', { defaultValue: 'Frequently Asked Questions' })}
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
            {FAQ_ITEMS.map((item, index) => (
              <FAQItem
                key={item.questionKey}
                question={t(item.questionKey, { defaultValue: item.defaultQuestion })}
                answer={t(item.answerKey, { defaultValue: item.defaultAnswer })}
                isDark={isDark}
                isLast={index === FAQ_ITEMS.length - 1}
              />
            ))}
          </View>
        </Animated.View>

        {/* Contact */}
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
            {t('support.contact', { defaultValue: 'Contact Us' })}
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
              onPress={handleContactSupport}
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
                <Mail
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
                  {t('support.emailSupport', { defaultValue: 'Email Support' })}
                </Text>
                <Text style={{ fontSize: 12, color: palette.neutral500, marginTop: 1 }}>
                  support@motovault.app
                </Text>
              </View>
            </Pressable>
          </View>
        </Animated.View>

        {/* App Info */}
        <Animated.View
          entering={FadeInUp.delay(160).duration(400)}
          style={{ paddingHorizontal: 20, marginTop: 40, alignItems: 'center' }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : palette.neutral100,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <MessageCircle size={22} color={palette.primary500} strokeWidth={1.8} />
          </View>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            MotoVault
          </Text>
          <Text style={{ fontSize: 13, color: palette.neutral500, marginTop: 2 }}>
            {t('support.version', { defaultValue: 'Version' })} {appVersion}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
