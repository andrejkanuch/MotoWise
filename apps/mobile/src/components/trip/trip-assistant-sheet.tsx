import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetScrollViewMethods,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { Send, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { AssistantMessage } from '../../hooks/use-trip-assistant';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { SYSTEM_WEIGHT, type } from '../../theme/type';

interface TripAssistantSheetProps {
  visible: boolean;
  onClose: () => void;
  messages: AssistantMessage[];
  isPending: boolean;
  onAsk: (question: string) => void;
  onReset: () => void;
}

/** Starter prompts, sent to the assistant in the rider's language. */
const SUGGESTION_KEYS = [
  'tripAssistant.prompts.coffee',
  'tripAssistant.prompts.curvier',
  'tripAssistant.prompts.hotel',
  'tripAssistant.prompts.rain',
] as const;

export function TripAssistantSheet({
  visible,
  onClose,
  messages,
  isPending,
  onAsk,
  onReset,
}: TripAssistantSheetProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const sheetRef = useRef<BottomSheet>(null);
  const scrollRef = useRef<BottomSheetScrollViewMethods | null>(null);
  const [draft, setDraft] = useState('');
  const snapPoints = useMemo(() => ['90%'], []);

  useEffect(() => {
    if (visible) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible]);

  if (!visible) return null;

  const bg = theme.surface;
  const handleColor = theme.ink4;
  const titleColor = theme.ink;
  const subColor = theme.ink3;
  // Rider bubbles are inverse ink (copper is reserved for actions).
  const userBg = theme.ink;
  const aiBg = theme.surface2;
  const aiTextColor = theme.ink;
  const inputBg = theme.surface2;

  const handleSend = () => {
    const q = draft.trim();
    if (!q || isPending) return;
    setDraft('');
    onAsk(q);
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={{ backgroundColor: bg }}
      handleIndicatorStyle={{ backgroundColor: handleColor }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingBottom: 12,
          gap: 10,
        }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: tint(theme.warm, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={16} color={theme.warm} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.bodyStrong, { color: titleColor }]}>{t('tripAssistant.title')}</Text>
          <Text style={[type.caption, { color: subColor, marginTop: 1 }]}>
            {t('tripAssistant.subtitle')}
          </Text>
        </View>
        {messages.length > 0 && (
          <Pressable onPress={onReset} hitSlop={8} accessibilityRole="button">
            <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: theme.warm2 }]}>
              {t('tripAssistant.reset')}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('tripShare.closeA11y')}
        >
          <X size={20} color={subColor} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 10 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={{ gap: 10, marginTop: 4 }}>
            <Text style={[type.label, { color: subColor }]}>{t('tripAssistant.tryAsking')}</Text>
            {SUGGESTION_KEYS.map((key) => (
              <Pressable
                key={key}
                onPress={() => onAsk(t(key))}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: aiBg,
                }}
              >
                <Text style={[type.subhead, { color: aiTextColor }]}>{t(key)}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {messages.map((m) => (
          <Animated.View
            key={m.id}
            entering={FadeIn.duration(160)}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: m.role === 'user' ? userBg : aiBg,
            }}
          >
            <Text style={[type.subhead, { color: m.role === 'user' ? theme.bg : aiTextColor }]}>
              {m.content}
            </Text>
          </Animated.View>
        ))}

        {isPending && (
          <View
            style={{
              alignSelf: 'flex-start',
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 16,
              borderCurve: 'continuous',
              backgroundColor: aiBg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ActivityIndicator size="small" color={theme.warm} />
            <Text style={[type.label, { color: subColor }]}>{t('tripAssistant.thinking')}</Text>
          </View>
        )}
      </BottomSheetScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 20,
          borderTopWidth: 1,
          borderTopColor: theme.line,
          backgroundColor: bg,
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: inputBg,
            borderRadius: 20,
            borderCurve: 'continuous',
            paddingHorizontal: 14,
            paddingVertical: 10,
            maxHeight: 120,
          }}
        >
          <BottomSheetTextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('trips.assistantPlaceholder')}
            placeholderTextColor={subColor}
            multiline
            style={{
              fontSize: 15,
              color: titleColor,
              minHeight: 20,
              maxHeight: 100,
            }}
            onSubmitEditing={handleSend}
          />
        </View>
        <Pressable
          onPress={handleSend}
          disabled={!draft.trim() || isPending}
          accessibilityRole="button"
          accessibilityLabel={t('tripAssistant.sendA11y')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: draft.trim() && !isPending ? theme.warm : aiBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={16} color={draft.trim() && !isPending ? theme.onWarm : subColor} />
        </Pressable>
      </View>
    </BottomSheet>
  );
}
