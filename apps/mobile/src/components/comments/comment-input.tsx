import { palette } from '@motovault/design-system';
import { Send } from 'lucide-react-native';
import { memo, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

interface CommentInputProps {
  onSubmit: (text: string) => void;
  isSubmitting?: boolean;
  replyingTo?: string;
  onCancelReply?: () => void;
  placeholder?: string;
}

const MAX_LENGTH = 500;

export const CommentInput = memo(function CommentInput({
  onSubmit,
  isSubmitting = false,
  replyingTo,
  onCancelReply,
  placeholder = 'Add a comment...',
}: CommentInputProps) {
  const isDark = useColorScheme() === 'dark';
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const bg = isDark ? palette.surfaceElevated : palette.neutral100;
  const textColor = isDark ? palette.white : palette.neutral950;
  const placeholderColor = isDark ? palette.neutral500 : palette.neutral400;
  const replyBg = isDark ? palette.primary900 : palette.primary50;
  const replyText = isDark ? palette.primary300 : palette.primary700;

  const canSubmit = text.trim().length > 0 && !isSubmitting;

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  }, [text, onSubmit]);

  return (
    <View>
      {/* Reply indicator */}
      {replyingTo && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: replyBg,
          }}
        >
          <Text style={{ fontSize: 12, color: replyText }}>
            Replying to comment
          </Text>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: replyText }}>Cancel</Text>
          </Pressable>
        </View>
      )}

      {/* Input row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: isDark ? palette.cardDark : palette.white,
          borderTopWidth: 0.5,
          borderTopColor: isDark ? palette.neutral800 : palette.neutral200,
        }}
      >
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          maxLength={MAX_LENGTH}
          multiline
          style={{
            flex: 1,
            fontSize: 15,
            lineHeight: 20,
            color: textColor,
            backgroundColor: bg,
            borderRadius: 20,
            borderCurve: 'continuous',
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 10,
            maxHeight: 100,
          }}
        />
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderCurve: 'continuous',
            backgroundColor: canSubmit ? palette.accent500 : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <Send
              size={18}
              color={canSubmit ? palette.white : placeholderColor}
            />
          )}
        </Pressable>
      </View>

      {/* Character count */}
      {text.length > 400 && (
        <Text
          style={{
            fontSize: 11,
            color: text.length >= MAX_LENGTH ? palette.danger500 : placeholderColor,
            textAlign: 'right',
            paddingRight: 16,
            paddingBottom: 4,
          }}
        >
          {text.length}/{MAX_LENGTH}
        </Text>
      )}
    </View>
  );
});
