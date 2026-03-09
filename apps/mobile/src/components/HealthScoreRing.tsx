import { palette } from '@motolearn/design-system';
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
  if (score >= 60) return '#EAB308'; // yellow
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
  const progress = useSharedValue(0);
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    progress.value = withTiming(hasData ? score / 100 : 0, { duration: 800 });
  }, [score, hasData, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const color = getScoreColor(score);

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
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 14,
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
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 32,
            fontWeight: '800',
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {score}
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '700',
            color,
            marginTop: -2,
          }}
        >
          {grade}
        </Text>
      </View>
    </View>
  );
}
