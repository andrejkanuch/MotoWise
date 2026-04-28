import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInUp,
  SlideOutDown,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { posthogClient } from '../../lib/analytics';
import { SURVEY_ID, useSurveyStore } from '../../stores/survey.store';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { EButton } from '../ui/editorial';

/**
 * Thin wrapper — subscribes to `visible`, returns null when hidden.
 * Animation hooks live in SurveyModal (only mounted when visible).
 */
export function SurveyOverlay() {
  const visible = useSurveyStore((s) => s.visible);
  if (!visible) return null;
  return <SurveyModal />;
}

// ── Modal ──

function SurveyModal() {
  const { t } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const triggerAction = useSurveyStore((s) => s.triggerAction);

  const [rating, setRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const onExitComplete = () => {
    useSurveyStore.getState().dismiss();
  };

  const handleDismiss = () => {
    if (isExiting) return;
    setIsExiting(true);
    posthogClient.capture('survey dismissed', {
      $survey_id: SURVEY_ID,
      trigger_action: triggerAction,
    });
  };

  const handleSubmit = () => {
    if (isSubmitting || !rating) return;
    setIsSubmitting(true);

    posthogClient.capture('survey sent', {
      $survey_id: SURVEY_ID,
      $survey_response: rating,
      ...(feedback.trim() ? { $survey_response_1: feedback.trim() } : {}),
      trigger_action: triggerAction,
    });

    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    handleDismiss();
  };

  const handleStarPress = (star: number) => {
    setRating(star);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  if (isExiting) {
    return (
      <Animated.View
        exiting={FadeOut.duration(200).withCallback((finished) => {
          'worklet';
          if (finished) runOnJS(onExitComplete)();
        })}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tint(t.ink, 0.6),
          justifyContent: 'flex-end',
          zIndex: 9999,
        }}
      />
    );
  }

  const starDelay = reduceMotion ? 0 : 50;
  const cardEntry = reduceMotion
    ? SlideInUp.duration(1)
    : SlideInUp.springify().damping(20).stiffness(200);

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
      accessibilityViewIsModal
    >
      {/* Backdrop */}
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(200)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: tint(t.ink, 0.6),
        }}
      >
        <Pressable
          style={{ flex: 1 }}
          onPress={handleDismiss}
          accessibilityLabel="Dismiss survey"
        />
      </Animated.View>

      {/* Card */}
      <Animated.View
        entering={cardEntry}
        exiting={SlideOutDown.duration(200).withCallback((finished) => {
          'worklet';
          if (finished) runOnJS(onExitComplete)();
        })}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom + 16,
          paddingTop: 24,
          paddingHorizontal: 20,
          backgroundColor: t.surface,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderCurve: 'continuous',
          borderTopWidth: 1,
          borderColor: t.line,
        }}
      >
        {/* Question */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: t.ink,
            textAlign: 'center',
            marginBottom: 20,
            letterSpacing: -0.3,
          }}
        >
          How satisfied are you with this experience?
        </Text>

        {/* Star rating */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[1, 2, 3, 4, 5].map((star, i) => (
            <Animated.View
              key={star}
              entering={reduceMotion ? undefined : SlideInUp.delay(i * starDelay).duration(300)}
            >
              <Pressable
                onPress={() => handleStarPress(star)}
                hitSlop={4}
                accessibilityRole="radio"
                accessibilityLabel={`Rate ${star} out of 5`}
                accessibilityState={{ selected: rating === star }}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Star
                  size={28}
                  color={rating != null && star <= rating ? t.warm : t.ink3}
                  fill={rating != null && star <= rating ? t.warm : 'transparent'}
                  strokeWidth={1.5}
                />
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* Optional text input — appears after star selection */}
        {rating != null && (
          <Animated.View
            entering={reduceMotion ? undefined : FadeIn.duration(200)}
            style={{ marginBottom: 20 }}
          >
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Share your thoughts (no personal info please)"
              placeholderTextColor={t.ink4}
              maxLength={500}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{
                backgroundColor: t.bg2,
                borderWidth: 1,
                borderColor: t.line,
                borderRadius: 12,
                borderCurve: 'continuous',
                padding: 14,
                fontSize: 15,
                color: t.ink,
                minHeight: 80,
                maxWidth: width - 40,
              }}
            />
          </Animated.View>
        )}

        {/* Actions */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <EButton label="Not now" variant="ghost" size="md" onPress={handleDismiss} />
          {rating != null && (
            <EButton
              label={isSubmitting ? 'Sending...' : 'Submit'}
              variant="primary"
              size="md"
              onPress={handleSubmit}
            />
          )}
        </View>
      </Animated.View>
    </View>
  );
}
