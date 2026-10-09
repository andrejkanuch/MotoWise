import { MotorcycleRecallsDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecallAcknowledgement } from '../../hooks/use-recall-acknowledgement';
import { formatFullDate } from '../../lib/bike-hub/format';
import {
  RECALL_ACK_ACTION,
  type RecallAckAction,
  type RecallItem,
  splitRecalls,
} from '../../lib/bike-hub/recall-acknowledgement';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { QUERY_META } from '../../lib/query-meta';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';

const NHTSA_RECALLS_URL = 'https://www.nhtsa.gov/recalls';
/** Card moves (open -> done and back) settle inside the 300ms motion budget. */
const CARD_LAYOUT = LinearTransition.duration(250);

/**
 * MOT-142: Safety recall results screen.
 *
 * Takes a motorcycleId param, runs the server-side NHTSA check (which uses
 * VIN when available and falls back to make/model/year), and renders each
 * recall campaign. Empty state is a clear "No open recalls" banner — the
 * absence of a recall is as valuable as the presence of one.
 *
 * Each open recall can be marked as done (00189): it moves into a collapsed
 * "Done (n)" group with its date and an Undo, and stops counting towards the
 * bike's recallCount (plate, garage badge, hub attention, CarPlay).
 */
export default function RecallsScreen() {
  const { t, i18n } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const { motorcycleId, bikeName } = useLocalSearchParams<{
    motorcycleId: string;
    bikeName?: string;
  }>();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.motorcycleRecalls.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MotorcycleRecallsDocument, { motorcycleId }),
    enabled: !!motorcycleId,
    staleTime: 60 * 60 * 1000, // 1 hour client-side (server caches 24h)
    // Renders its own error banner. The bike hub's Overview observes this key
    // with the same opt-out; the global handler needs every observer to agree.
    meta: QUERY_META.OWN_ERROR_UI,
  });

  const result = data?.motorcycleRecalls;
  const { open, done } = splitRecalls(result?.recalls ?? []);
  const count = open.length;
  const hasRecalls = count > 0;
  const [doneExpanded, setDoneExpanded] = useState(false);
  const ackMutation = useRecallAcknowledgement(motorcycleId);

  const runAck = (campaignNumber: string, action: RecallAckAction) => {
    triggerImpact(ImpactFeedbackStyle.Light);
    // Errors alert from the hook, so the alert survives the sheet closing.
    ackMutation.mutate({ campaignNumber, action });
  };

  const confirmMarkDone = (recall: RecallItem) => {
    Alert.alert(
      t('recalls.markDoneConfirmTitle', { defaultValue: 'Mark this recall as done?' }),
      t('recalls.markDoneConfirmMessage', {
        defaultValue: "You won't be alerted about campaign {{campaign}} for this bike again.",
        campaign: recall.campaignNumber,
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('recalls.markDone', { defaultValue: 'Mark as done' }),
          onPress: () => runAck(recall.campaignNumber, RECALL_ACK_ACTION.ACKNOWLEDGE),
        },
      ],
    );
  };

  const bg = theme.bg;
  const card = theme.surface;
  const textColor = theme.ink;
  const mutedText = theme.ink3;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.goBack', { defaultValue: 'Go back' })}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={24} color={textColor} strokeWidth={2} />
        </Pressable>
        <Text accessibilityRole="header" style={{ ...type.sheetTitle, color: textColor, flex: 1 }}>
          {t('recalls.title', { defaultValue: 'Safety Recalls' })}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
        {bikeName && (
          <Text style={{ ...type.subhead, color: mutedText, marginBottom: space.xxs }}>
            {bikeName}
          </Text>
        )}

        {isLoading && (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.ink3} />
            <Text style={{ ...type.subhead, marginTop: space.sm, color: mutedText }}>
              {t('recalls.checking', { defaultValue: 'Checking NHTSA database…' })}
            </Text>
          </View>
        )}

        {error && !isLoading && (
          <View
            style={{
              backgroundColor: tint(theme.danger, 0.12),
              padding: space.md,
              borderRadius: radius.control,
              borderCurve: 'continuous',
            }}
          >
            <Text style={{ ...type.bodyStrong, color: theme.overdueInk }}>
              {t('recalls.error', {
                defaultValue: 'Could not reach the NHTSA database. Please try again.',
              })}
            </Text>
          </View>
        )}

        {!isLoading && !error && !hasRecalls && (
          <Animated.View
            entering={FadeInUp.duration(300)}
            style={{
              backgroundColor: tint(theme.success, 0.12),
              padding: space.lg,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              flexDirection: 'row',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <ShieldCheck size={24} color={theme.success} strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={{ ...type.bodyStrong, color: textColor }}>
                {t('recalls.none', { defaultValue: 'No open recalls found' })}
              </Text>
              <Text style={{ ...type.subhead, color: mutedText, marginTop: space.xxs }}>
                {done.length > 0
                  ? t('recalls.allDoneDescription', {
                      defaultValue: 'Every recall for this bike is marked as done.',
                    })
                  : t('recalls.noneDescription', {
                      defaultValue:
                        'NHTSA has no open safety recall campaigns for this motorcycle at this time.',
                    })}
              </Text>
            </View>
          </Animated.View>
        )}

        {!isLoading && hasRecalls && (
          <>
            <View
              style={{
                backgroundColor: tint(theme.plateDue, 0.14),
                padding: space.md,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <AlertTriangle size={22} color={theme.dueInk} strokeWidth={2} />
              <Text style={{ ...type.bodyStrong, flex: 1, color: textColor }}>
                {t('recalls.openCount', {
                  defaultValue: `${count} open recall${count === 1 ? '' : 's'} found`,
                  count,
                })}
              </Text>
            </View>

            {open.map((recall, index) => (
              <Animated.View
                key={recall.campaignNumber}
                entering={FadeInUp.delay(index * 50).duration(250)}
                exiting={FadeOut.duration(200)}
                layout={CARD_LAYOUT}
                style={{
                  backgroundColor: card,
                  padding: space.md,
                  borderRadius: radius.card,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: theme.line,
                  gap: space.sm,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text
                    style={{
                      ...type.label,
                      ...SYSTEM_WEIGHT.semibold,
                      flex: 1,
                      color: theme.overdueInk,
                    }}
                  >
                    {recall.component}
                  </Text>
                  <Text style={{ ...type.caption, color: mutedText }}>{recall.reportDate}</Text>
                </View>

                <Text style={{ ...type.subhead, color: textColor }}>{recall.summary}</Text>

                <View
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: theme.line2,
                    paddingTop: space.sm,
                    gap: 6,
                  }}
                >
                  <Text style={{ ...type.caption, ...SYSTEM_WEIGHT.semibold, color: mutedText }}>
                    {t('recalls.consequence', { defaultValue: 'CONSEQUENCE' })}
                  </Text>
                  <Text style={{ ...type.subhead, color: textColor }}>{recall.consequence}</Text>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ ...type.caption, ...SYSTEM_WEIGHT.semibold, color: mutedText }}>
                    {t('recalls.remedy', { defaultValue: 'REMEDY' })}
                  </Text>
                  <Text style={{ ...type.subhead, color: textColor }}>{recall.remedy}</Text>
                </View>

                <Text style={{ ...type.caption, color: mutedText, marginTop: space.xxs }}>
                  {t('recalls.campaign', { defaultValue: 'Campaign' })}: {recall.campaignNumber}
                </Text>

                {/* Secondary (ghost) action: copper is reserved for primary actions. */}
                <Pressable
                  testID={`recall-mark-done-${recall.campaignNumber}`}
                  onPress={() => confirmMarkDone(recall)}
                  accessibilityRole="button"
                  accessibilityLabel={t('recalls.markDone', { defaultValue: 'Mark as done' })}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    borderRadius: radius.control,
                    borderCurve: 'continuous',
                    borderWidth: 1,
                    borderColor: theme.line,
                    backgroundColor: pressed ? theme.surface2 : 'transparent',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: space.xs,
                    paddingHorizontal: space.md,
                  })}
                >
                  <Check size={18} color={theme.ink2} strokeWidth={2} />
                  <Text style={{ ...type.bodyStrong, color: textColor }}>
                    {t('recalls.markDone', { defaultValue: 'Mark as done' })}
                  </Text>
                </Pressable>
              </Animated.View>
            ))}
          </>
        )}

        {!isLoading && done.length > 0 && (
          <Animated.View layout={CARD_LAYOUT} style={{ gap: space.xs, marginTop: space.sm }}>
            <Pressable
              testID="recalls-done-toggle"
              onPress={() => setDoneExpanded((expanded) => !expanded)}
              accessibilityRole="button"
              accessibilityState={{ expanded: doneExpanded }}
              hitSlop={8}
              style={{
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xxs,
                paddingHorizontal: space.md,
              }}
            >
              <Text style={{ ...type.label, color: theme.ink3, flex: 1 }}>
                {t('recalls.doneSection', {
                  defaultValue: 'Done ({{count}})',
                  count: done.length,
                })}
              </Text>
              {doneExpanded ? (
                <ChevronDown size={18} color={theme.ink3} strokeWidth={2} />
              ) : (
                <ChevronRight size={18} color={theme.ink3} strokeWidth={2} />
              )}
            </Pressable>

            {doneExpanded && (
              <Animated.View
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(150)}
                style={{
                  backgroundColor: card,
                  borderRadius: radius.card,
                  borderCurve: 'continuous',
                  overflow: 'hidden',
                }}
              >
                {done.map((recall, index) => (
                  <Animated.View
                    key={recall.campaignNumber}
                    testID={`recall-done-${recall.campaignNumber}`}
                    entering={FadeIn.duration(200)}
                    layout={CARD_LAYOUT}
                    style={{
                      minHeight: 52,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: space.sm,
                      paddingVertical: space.sm,
                      paddingLeft: space.md,
                      paddingRight: space.xs,
                      borderTopWidth: index === 0 ? 0 : 0.5,
                      borderTopColor: theme.line,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ ...type.body, color: textColor }} numberOfLines={2}>
                        {recall.component}
                      </Text>
                      <Text style={{ ...type.caption, color: mutedText }}>
                        {recall.acknowledgedAt
                          ? t('recalls.doneOn', {
                              defaultValue: 'Marked done {{date}}',
                              date: formatFullDate(recall.acknowledgedAt, i18n.language),
                            })
                          : null}
                        {recall.acknowledgedAt ? ' · ' : ''}
                        {recall.campaignNumber}
                      </Text>
                    </View>
                    <Pressable
                      testID={`recall-undo-${recall.campaignNumber}`}
                      onPress={() => runAck(recall.campaignNumber, RECALL_ACK_ACTION.UNACKNOWLEDGE)}
                      accessibilityRole="button"
                      accessibilityLabel={t('recalls.undoA11y', {
                        defaultValue: 'Undo: mark campaign {{campaign}} as open',
                        campaign: recall.campaignNumber,
                      })}
                      hitSlop={8}
                      style={{
                        minHeight: 44,
                        minWidth: 44,
                        paddingHorizontal: space.sm,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ ...type.bodyStrong, color: theme.warm2 }}>
                        {t('recalls.undo', { defaultValue: 'Undo' })}
                      </Text>
                    </Pressable>
                  </Animated.View>
                ))}
              </Animated.View>
            )}
          </Animated.View>
        )}

        {/* NHTSA attribution */}
        <Pressable
          onPress={() => Linking.openURL(NHTSA_RECALLS_URL)}
          accessibilityRole="link"
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: radius.control,
            borderCurve: 'continuous',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: card,
          }}
        >
          <Text style={{ ...type.caption, color: mutedText }}>
            {t('recalls.attribution', { defaultValue: 'Recall data from NHTSA' })}
          </Text>
          <ExternalLink size={12} color={mutedText} />
        </Pressable>
      </ScrollView>
    </View>
  );
}
