import { palette } from '@motovault/design-system';
import { CreateGroupRideDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';

type Difficulty = 'easy' | 'moderate' | 'challenging';

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'Easy' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'challenging', label: 'Challenging' },
];

const DIFFICULTY_COLORS = {
  easy: palette.success500,
  moderate: palette.warning500,
  challenging: palette.danger500,
} as const;

export default function CreateGroupRideScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const bg = isDark ? palette.neutral950 : palette.white;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const inputBg = isDark ? palette.cardDark : palette.neutral100;
  const inputBorder = isDark ? palette.surfaceElevated : palette.neutral200;
  const inputTextColor = isDark ? palette.white : palette.neutral950;
  const placeholderColor = isDark ? palette.neutral600 : palette.neutral400;
  const labelColor = isDark ? palette.neutral300 : palette.neutral600;
  const chipBg = isDark ? palette.neutral800 : palette.neutral200;
  const chipSelectedBg = isDark ? palette.surfaceElevated : palette.neutral100;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [meetingPoint, setMeetingPoint] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate');
  const [maxRiders, setMaxRiders] = useState('10');

  const isValid = title.trim().length > 0 && description.trim().length > 0;

  const createMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(CreateGroupRideDocument, {
        input: {
          title: title.trim(),
          description: description.trim(),
          dateTime: dateTime.trim() || new Date().toISOString(),
          meetingPointLat: 0,
          meetingPointLng: 0,
          meetingPointName: meetingPoint.trim() || undefined,
          difficulty,
          maxRiders: Number.parseInt(maxRiders, 10) || 10,
        },
      }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: queryKeys.groupRides.all });
      router.back();
    },
  });

  const handleSubmit = useCallback(() => {
    if (!isValid || createMutation.isPending) return;
    createMutation.mutate();
  }, [isValid, createMutation]);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            paddingBottom: 12,
            gap: 12,
          }}
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderCurve: 'continuous',
              backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} color={titleColor} />
          </Pressable>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: '700', color: titleColor }}>
            Create Group Ride
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 100,
            gap: 18,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Animated.View entering={FadeInUp.delay(0).duration(250)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
              Title *
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Sunday Morning Cruise"
              placeholderTextColor={placeholderColor}
              maxLength={100}
              style={{
                backgroundColor: inputBg,
                borderWidth: 1,
                borderColor: inputBorder,
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: inputTextColor,
              }}
            />
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInUp.delay(50).duration(250)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
              Description *
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the ride, route highlights, what to bring..."
              placeholderTextColor={placeholderColor}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={1000}
              style={{
                backgroundColor: inputBg,
                borderWidth: 1,
                borderColor: inputBorder,
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: inputTextColor,
                minHeight: 100,
              }}
            />
          </Animated.View>

          {/* Date & Time */}
          <Animated.View entering={FadeInUp.delay(100).duration(250)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
              Date & Time
            </Text>
            <TextInput
              value={dateTime}
              onChangeText={setDateTime}
              placeholder="e.g. 2026-04-12T09:00"
              placeholderTextColor={placeholderColor}
              style={{
                backgroundColor: inputBg,
                borderWidth: 1,
                borderColor: inputBorder,
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: inputTextColor,
              }}
            />
            <Text style={{ fontSize: 11, color: subtitleColor, marginTop: 4 }}>
              ISO format for now — date picker coming soon
            </Text>
          </Animated.View>

          {/* Meeting Point */}
          <Animated.View entering={FadeInUp.delay(150).duration(250)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
              Meeting Point
            </Text>
            <TextInput
              value={meetingPoint}
              onChangeText={setMeetingPoint}
              placeholder="e.g. Gas station on Main St"
              placeholderTextColor={placeholderColor}
              maxLength={200}
              style={{
                backgroundColor: inputBg,
                borderWidth: 1,
                borderColor: inputBorder,
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: inputTextColor,
              }}
            />
          </Animated.View>

          {/* Difficulty */}
          <Animated.View entering={FadeInUp.delay(200).duration(250)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
              Difficulty
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {DIFFICULTIES.map((d) => {
                const isSelected = difficulty === d.key;
                const accentColor = DIFFICULTY_COLORS[d.key];
                return (
                  <Pressable
                    key={d.key}
                    onPress={() => setDifficulty(d.key)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 10,
                      borderCurve: 'continuous',
                      borderWidth: 1.5,
                      borderColor: isSelected ? accentColor : inputBorder,
                      backgroundColor: isSelected ? chipSelectedBg : chipBg,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: isSelected ? '700' : '500',
                        color: isSelected ? accentColor : subtitleColor,
                      }}
                    >
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* Max Riders */}
          <Animated.View entering={FadeInUp.delay(250).duration(250)}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: labelColor, marginBottom: 6 }}>
              Max Riders
            </Text>
            <TextInput
              value={maxRiders}
              onChangeText={(text) => setMaxRiders(text.replace(/[^0-9]/g, ''))}
              placeholder="10"
              placeholderTextColor={placeholderColor}
              keyboardType="number-pad"
              maxLength={3}
              style={{
                backgroundColor: inputBg,
                borderWidth: 1,
                borderColor: inputBorder,
                borderRadius: 12,
                borderCurve: 'continuous',
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                color: inputTextColor,
                width: 100,
              }}
            />
          </Animated.View>

          {/* Error message */}
          {createMutation.isError && (
            <Text style={{ fontSize: 13, color: palette.danger500, textAlign: 'center' }}>
              Failed to create ride. Please try again.
            </Text>
          )}
        </ScrollView>

        {/* Submit button */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 12,
            paddingTop: 12,
            backgroundColor: bg,
            borderTopWidth: 1,
            borderTopColor: isDark ? palette.surfaceElevated : palette.neutral200,
          }}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={!isValid || createMutation.isPending}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 14,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: isValid
                ? palette.accent500
                : isDark
                  ? palette.neutral800
                  : palette.neutral300,
              opacity: createMutation.isPending ? 0.7 : 1,
            }}
          >
            {createMutation.isPending ? (
              <ActivityIndicator size="small" color={palette.white} />
            ) : (
              <>
                <Plus size={18} color={palette.white} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
                  Create Group Ride
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
