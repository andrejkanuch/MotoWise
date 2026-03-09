import { palette } from '@motolearn/design-system';
import Svg, { Path } from 'react-native-svg';

const PATHS: Record<string, string> = {
  sport:
    'M15 45 Q20 25 35 22 Q42 20 50 18 Q58 16 65 20 Q72 24 78 30 Q82 35 85 42 L88 45 Q88 50 83 50 Q80 50 80 47 Q80 43 76 43 Q72 43 72 47 Q72 50 68 50 L32 50 Q28 50 28 47 Q28 43 24 43 Q20 43 20 47 Q20 50 17 50 Q12 50 15 45 Z M38 25 Q42 22 50 21 L65 22 Q58 22 52 25 Q46 28 42 28 Q38 28 38 25 Z',
  cruiser:
    'M10 45 Q12 35 20 30 L35 28 Q40 26 50 25 Q55 25 60 26 L80 30 Q88 34 90 42 L90 45 Q90 50 85 50 Q82 50 82 47 Q82 43 78 43 Q74 43 74 47 Q74 50 70 50 L30 50 Q26 50 26 47 Q26 43 22 43 Q18 43 18 47 Q18 50 15 50 Q10 50 10 45 Z M30 30 L50 27 Q55 27 58 28 L35 30 Q32 30 30 30 Z',
  adventure:
    'M12 44 Q15 30 25 25 L40 22 Q48 20 55 20 Q62 20 68 23 L82 30 Q88 35 88 44 L88 46 Q88 50 84 50 Q80 50 80 46 Q80 42 76 42 Q72 42 72 46 Q72 50 68 50 L32 50 Q28 50 28 46 Q28 42 24 42 Q20 42 20 46 Q20 50 16 50 Q12 50 12 46 Z M30 25 L55 22 Q60 22 65 24 L45 26 Q38 26 30 25 Z M48 14 L52 14 L54 20 L46 20 Z',
  standard:
    'M14 45 Q16 32 26 27 L40 24 Q48 22 55 22 Q62 22 68 24 L80 28 Q86 33 88 43 L88 45 Q88 50 84 50 Q80 50 80 47 Q80 43 76 43 Q72 43 72 47 Q72 50 68 50 L30 50 Q26 50 26 47 Q26 43 22 43 Q18 43 18 47 Q18 50 14 50 Q10 50 14 45 Z M32 27 L55 24 Q60 24 65 25 L42 27 Q36 27 32 27 Z',
};

export function BikeIcon({
  variant = 'standard',
  size = 64,
  color = palette.neutral400,
}: {
  variant?: 'sport' | 'cruiser' | 'adventure' | 'standard';
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size * 0.45} viewBox="5 12 90 42">
      <Path d={PATHS[variant]} fill={color} />
    </Svg>
  );
}
