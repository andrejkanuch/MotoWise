import BottomSheet, {
  BottomSheetScrollView,
  type BottomSheetScrollViewMethods,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { palette } from '@motovault/design-system';
import { Send, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { AssistantMessage } from '../../hooks/use-trip-assistant';

interface TripAssistantSheetProps {
  visible: boolean;
  onClose: () => void;
  messages: AssistantMessage[];
  isPending: boolean;
  onAsk: (question: string) => void;
  onReset: () => void;
}

const SUGGESTIONS = [
  'Coffee stop between stop 2 and 3, max 5 min off-route',
  'Curvier alternative to tomorrow afternoon',
  'Motorcycle-friendly hotel near the last stop',
  'Best detour if it rains tomorrow PM',
];

export function TripAssistantSheet({
  visible,
  onClose,
  messages,
  isPending,
  onAsk,
  onReset,
}: TripAssistantSheetProps) {
  const isDark = useColorScheme() === 'dark';
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

  const bg = isDark ? palette.neutral950 : palette.white;
  const handleColor = isDark ? palette.neutral600 : palette.neutral300;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subColor = isDark ? palette.neutral400 : palette.neutral500;
  const userBg = palette.accent500;
  const aiBg = isDark ? palette.surfaceElevated : palette.neutral100;
  const aiTextColor = isDark ? palette.neutral100 : palette.neutral900;
  const inputBg = isDark ? palette.surfaceElevated : palette.neutral100;

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
            backgroundColor: `${palette.accent500}22`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sparkles size={16} color={palette.accent500} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: titleColor }}>Trip assistant</Text>
          <Text style={{ fontSize: 12, color: subColor, marginTop: 1 }}>
            Knows your bike, waypoints, and days.
          </Text>
        </View>
        {messages.length > 0 && (
          <Pressable onPress={onReset} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontSize: 13, color: palette.accent500, fontWeight: '600' }}>Reset</Text>
          </Pressable>
        )}
        <Pressable
          onPress={onClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
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
            <Text style={{ fontSize: 13, color: subColor }}>Try asking:</Text>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => onAsk(s)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: aiBg,
                }}
              >
                <Text style={{ fontSize: 14, color: aiTextColor, lineHeight: 20 }}>{s}</Text>
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
            <Text
              style={{
                fontSize: 14,
                lineHeight: 20,
                color: m.role === 'user' ? palette.white : aiTextColor,
              }}
            >
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
            <ActivityIndicator size="small" color={palette.accent500} />
            <Text style={{ fontSize: 13, color: subColor }}>Thinking…</Text>
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
          borderTopColor: isDark ? palette.neutral800 : palette.neutral200,
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
            placeholder="Ask about your trip…"
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
          accessibilityLabel="Send message"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: draft.trim() && !isPending ? palette.accent500 : aiBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Send size={16} color={draft.trim() && !isPending ? palette.white : subColor} />
        </Pressable>
      </View>
    </BottomSheet>
  );
}
