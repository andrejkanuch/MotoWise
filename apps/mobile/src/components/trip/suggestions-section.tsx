/**
 * P5.1 — suggestions list shown on trip-detail.
 *
 * Scoped to the minimum riders actually need: see open suggestions, and if
 * you're the organiser or a co-planner, accept or reject them. Adding new
 * suggestions happens via the MapPicker flow the organiser already uses —
 * we piggy-back on that instead of duplicating an input here.
 */
import { Check, CheckCircle2, Clock, X, XCircle } from 'lucide-react-native';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { TripSuggestion } from '../../hooks/use-trip-suggestions';
import { tint as tintColor, useEditorialTheme } from '../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../theme/type';

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
  const { t } = useEditorialTheme();

  const sectionBg = t.surface;
  const borderColor = t.line;
  const headingColor = t.ink;
  const bodyColor = t.ink2;
  const metaColor = t.ink3;

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
        <Text style={[type.sectionTitle, { color: headingColor }]}>Suggestions</Text>
        {pendingCount > 0 && (
          <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: t.plateDue }]}>
            {pendingCount} pending
          </Text>
        )}
      </View>

      {isLoading && suggestions.length === 0 ? (
        <View style={{ paddingVertical: 14 }}>
          <ActivityIndicator color={t.ink3} />
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
                ? t.success
                : s.status === 'rejected'
                  ? t.danger
                  : s.status === 'withdrawn'
                    ? t.ink3
                    : t.plateDue;
            const StatusIcon =
              s.status === 'accepted' ? CheckCircle2 : s.status === 'rejected' ? XCircle : Clock;

            return (
              <Animated.View
                key={s.id}
                entering={FadeInUp.delay(idx * 40).duration(220)}
                style={{
                  borderRadius: radius.card,
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
                    style={[
                      type.caption,
                      SYSTEM_WEIGHT.semibold,
                      { color: statusTint, textTransform: 'capitalize' },
                    ]}
                  >
                    {s.status}
                  </Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[type.caption, { color: metaColor }]}>
                    {formatRelative(s.createdAt)}
                  </Text>
                </View>
                <Text style={[type.bodyStrong, { color: headingColor }]} numberOfLines={2}>
                  {s.name}
                </Text>
                {s.notes ? (
                  <Text style={[type.subhead, { color: bodyColor }]}>{s.notes}</Text>
                ) : null}
                <Text style={[type.caption, { color: metaColor }]}>
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
                          tint={t.success}
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
                          tint={t.danger}
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
                        tint={t.ink3}
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
                  <Text style={[type.caption, { color: metaColor }]}>Note: {s.decidedNote}</Text>
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
        minHeight: 44,
        paddingHorizontal: space.sm,
        borderRadius: 999,
        backgroundColor: tintColor(tint, 0.14),
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Icon size={14} color={tint} />
      <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}
