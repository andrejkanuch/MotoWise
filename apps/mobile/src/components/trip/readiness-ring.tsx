import { palette } from '@motovault/design-system';
import { Check, ChevronDown, ChevronUp, Share2, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { ReadinessReport } from '../../utils/readiness';

interface ReadinessRingProps {
  report: ReadinessReport;
  onShareBrief?: () => void;
}

const RING_SIZE = 56;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUM = 2 * Math.PI * RING_RADIUS;

function colorForScore(score: number): string {
  if (score >= 0.8) return palette.success500;
  if (score >= 0.5) return palette.warning500;
  return palette.danger500;
}

export function ReadinessRing({ report, onShareBrief }: ReadinessRingProps) {
  const isDark = useColorScheme() === 'dark';
  const [expanded, setExpanded] = useState(false);

  const pct = Math.round(report.score * 100);
  const color = colorForScore(report.score);
  const titleColor = isDark ? palette.white : palette.neutral950;
  const subColor = isDark ? palette.neutral400 : palette.neutral500;
  const cardBg = isDark ? palette.surfaceElevated : palette.neutral50;

  const headline = useMemo(() => {
    if (report.score >= 0.95) return 'Ready to ride';
    if (report.score >= 0.8) return 'Nearly ready';
    if (report.score >= 0.5) return 'Some checks pending';
    return 'Needs attention';
  }, [report.score]);

  const strokeDashoffset = RING_CIRCUM * (1 - report.score);

  const handleToggle = useCallback(() => setExpanded((v) => !v), []);
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <View
      style={{
        backgroundColor: cardBg,
        borderRadius: 14,
        borderCurve: 'continuous',
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 16,
      }}
    >
      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`${headline}. ${pct} percent ready. Tap to see the checklist.`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <View style={{ width: RING_SIZE, height: RING_SIZE }}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={isDark ? palette.neutral800 : palette.neutral200}
              strokeWidth={RING_STROKE}
              fill="transparent"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke={color}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUM}
              strokeDashoffset={strokeDashoffset}
              fill="transparent"
              // Rotate so the stroke starts at 12 o'clock.
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: titleColor }}>{pct}%</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: titleColor }}>{headline}</Text>
          <Text style={{ fontSize: 12, color: subColor, marginTop: 2 }}>
            {report.passed}/{report.total} checks pass
          </Text>
        </View>
        <Chevron size={18} color={subColor} />
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(140)} style={{ marginTop: 10, gap: 8 }}>
          {report.items.map((item) => {
            const Icon = item.passed ? Check : X;
            const iconColor = item.passed
              ? palette.success500
              : item.severity === 'required'
                ? palette.danger500
                : palette.warning500;
            return (
              <View
                key={item.key}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: `${iconColor}1F`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  <Icon size={13} color={iconColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: titleColor }}>
                    {item.label}
                  </Text>
                  {item.note && (
                    <Text style={{ fontSize: 12, color: subColor, marginTop: 2 }}>{item.note}</Text>
                  )}
                </View>
              </View>
            );
          })}

          {onShareBrief && (
            <Pressable
              onPress={onShareBrief}
              accessibilityRole="button"
              accessibilityLabel="Share tank-bag brief"
              style={{
                marginTop: 8,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 10,
                borderRadius: 10,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: isDark ? palette.neutral700 : palette.neutral200,
              }}
            >
              <Share2 size={14} color={titleColor} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: titleColor }}>
                Share tank-bag brief
              </Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}
