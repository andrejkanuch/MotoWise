/**
 * P5.1 — suggestions list shown on trip-detail.
 *
 * Scoped to the minimum riders actually need: see open suggestions, and if
 * you're the organiser or a co-planner, accept or reject them. Adding new
 * suggestions happens via the MapPicker flow the organiser already uses —
 * we piggy-back on that instead of duplicating an input here.
 */
import { palette } from '@motovault/design-system';
import { Check, CheckCircle2, Clock, X, XCircle } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { TripSuggestion } from '../../hooks/use-trip-suggestions';

interface SuggestionsSectionProps {
  suggestions: TripSuggestion[];
  isLoading: boolean;
  /** True when the viewer can accept/reject — organiser or co-planner. */
  canDecide: boolean;
  currentUserId?: string;
  onRespond: (input: {
    suggestionId: string;
    decision: 'accepted' | 'rejected' | 'withdrawn';
  }) => Promise<unknown> | undefined;
  /** Set of suggestion ids with an in-flight respond mutation. */
  respondingIds: ReadonlySet<string>;
}

function formatRelative(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function SuggestionsSection({
  suggestions,
  isLoading,
  canDecide,
  currentUserId,
  onRespond,
  respondingIds,
}: SuggestionsSectionProps) {
  const isDark = useColorScheme() === 'dark';

  const sectionBg = isDark ? palette.cardDark : palette.white;
  const borderColor = isDark ? palette.neutral700 : palette.neutral200;
  const headingColor = isDark ? palette.neutral50 : palette.neutral950;
  const bodyColor = isDark ? palette.neutral300 : palette.neutral600;
  const metaColor = isDark ? palette.neutral400 : palette.neutral500;

  // Surface open ones first, then most recently decided.
  const ordered = useMemo(() => {
    return [...suggestions].sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [suggestions]);

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;

  if (!isLoading && suggestions.length === 0) return null;

  return (
    <View style={{ marginTop: 20, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text
          style={{
            color: headingColor,
            fontSize: 17,
            fontWeight: '800',
            letterSpacing: -0.2,
          }}
        >
          Suggestions
        </Text>
        {pendingCount > 0 && (
          <Text style={{ color: palette.warning500, fontSize: 13, fontWeight: '700' }}>
            {pendingCount} pending
          </Text>
        )}
      </View>

      {isLoading && suggestions.length === 0 ? (
        <View style={{ paddingVertical: 14 }}>
          <ActivityIndicator color={palette.accent500} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {ordered.map((s, idx) => {
            const isPending = s.status === 'pending';
            const decided = !isPending;
            const isAuthor = currentUserId && s.author.id === currentUserId;
            const rowResponding = respondingIds.has(s.id);

            const statusTint =
              s.status === 'accepted'
                ? palette.success500
                : s.status === 'rejected'
                  ? palette.danger500
                  : s.status === 'withdrawn'
                    ? palette.neutral400
                    : palette.warning500;
            const StatusIcon =
              s.status === 'accepted' ? CheckCircle2 : s.status === 'rejected' ? XCircle : Clock;

            return (
              <Animated.View
                key={s.id}
                entering={FadeInUp.delay(idx * 40).duration(220)}
                style={{
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor,
                  backgroundColor: sectionBg,
                  padding: 14,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <StatusIcon size={14} color={statusTint} />
                  <Text
                    style={{
                      color: statusTint,
                      fontSize: 11,
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: 0.4,
                    }}
                  >
                    {s.status}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Text style={{ color: metaColor, fontSize: 12 }}>
                    {formatRelative(s.createdAt)}
                  </Text>
                </View>
                <Text
                  style={{
                    color: headingColor,
                    fontSize: 15,
                    fontWeight: '700',
                  }}
                  numberOfLines={2}
                >
                  {s.name}
                </Text>
                {s.notes ? (
                  <Text style={{ color: bodyColor, fontSize: 13, lineHeight: 18 }}>{s.notes}</Text>
                ) : null}
                <Text style={{ color: metaColor, fontSize: 12 }}>
                  Suggested by {s.author.displayName}
                  {typeof s.dayIndex === 'number' ? ` · Day ${s.dayIndex + 1}` : ''}
                  {s.periodOfDay ? ` · ${s.periodOfDay}` : ''}
                </Text>

                {isPending && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                    {canDecide && (
                      <>
                        <ActionButton
                          label="Accept"
                          tint={palette.success500}
                          Icon={Check}
                          disabled={rowResponding}
                          onPress={() =>
                            onRespond({
                              suggestionId: s.id,
                              decision: 'accepted',
                            })
                          }
                        />
                        <ActionButton
                          label="Reject"
                          tint={palette.danger500}
                          Icon={X}
                          disabled={rowResponding}
                          onPress={() =>
                            onRespond({
                              suggestionId: s.id,
                              decision: 'rejected',
                            })
                          }
                        />
                      </>
                    )}
                    {isAuthor && (
                      <ActionButton
                        label="Withdraw"
                        tint={palette.neutral500}
                        Icon={X}
                        disabled={rowResponding}
                        onPress={() =>
                          onRespond({
                            suggestionId: s.id,
                            decision: 'withdrawn',
                          })
                        }
                      />
                    )}
                  </View>
                )}

                {decided && s.decidedNote ? (
                  <Text
                    style={{
                      color: metaColor,
                      fontSize: 12,
                      fontStyle: 'italic',
                    }}
                  >
                    Note: {s.decidedNote}
                  </Text>
                ) : null}
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
}

interface ActionButtonProps {
  label: string;
  tint: string;
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  onPress: () => void;
  disabled?: boolean;
}

function ActionButton({ label, tint, Icon, onPress, disabled }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: `${tint}22`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={14} color={tint} />
      <Text style={{ color: tint, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
