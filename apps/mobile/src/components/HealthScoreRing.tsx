import { palette } from '@motovault/design-system';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import type { HealthGrade } from '../lib/health-score';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 140;
const STROKE_WIDTH = 10;

function getScoreColor(score: number): string {
  if (score >= 75) return palette.success500;
  if (score >= 60) return palette.warning500;
  if (score >= 40) return palette.warning500;
  return palette.danger500;
}

interface Props {
  score: number;
  grade: HealthGrade;
  hasData: boolean;
  isDark: boolean;
  size?: number;
}

export function HealthScoreRing({ score, grade, hasData, isDark, size = SIZE }: Props) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const scale = size / SIZE;
  const strokeWidth = Math.max(4, Math.round(STROKE_WIDTH * scale));
  const scoreFontSize = Math.max(14, Math.round(32 * scale));
  const gradeFontSize = Math.max(9, Math.round(13 * scale));
  const gradeMarginTop = Math.round(-2 * scale);
  const noDataFontSize = Math.max(10, Math.round(14 * scale));

  const progress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    progress.value = withTiming(hasData ? clampedScore / 100 : 0, { duration: 800 });
  }, [clampedScore, hasData, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const color = getScoreColor(clampedScore);

  if (!hasData) {
    return (
      <View
        style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
        accessibilityLabel="No maintenance data yet"
      >
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={isDark ? palette.neutral700 : palette.neutral200}
            strokeWidth={strokeWidth}
            fill="none"
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text
            style={{
              fontSize: noDataFontSize,
              fontWeight: '600',
              color: palette.neutral400,
            }}
          >
            No Data
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={`Maintenance health score: ${score} out of 100, grade ${grade}`}
    >
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDark ? palette.neutral700 : palette.neutral200}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {size >= 60 && (
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text
            style={{
              fontSize: scoreFontSize,
              fontWeight: '800',
              color: isDark ? palette.neutral50 : palette.neutral950,
            }}
          >
            {clampedScore}
          </Text>
          <Text
            style={{
              fontSize: gradeFontSize,
              fontWeight: '700',
              color,
              marginTop: gradeMarginTop,
            }}
          >
            {grade}
          </Text>
        </View>
      )}
    </View>
  );
}
