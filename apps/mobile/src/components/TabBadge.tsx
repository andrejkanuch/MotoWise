import { palette } from '@motolearn/design-system';
import { Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

interface Props {
  count: number;
}

export function TabBadge({ count }: Props) {
  if (count <= 0) return null;

  const display = count >= 10 ? '9+' : String(count);

  return (
    <Animated.View entering={ZoomIn.springify()}>
      <View
        style={{
          position: 'absolute',
          top: -6,
          right: -10,
          backgroundColor: palette.danger500,
          borderRadius: 9,
          minWidth: 18,
          height: 18,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 4,
        }}
      >
        <Text
          style={{
            fontSize: 10,
            fontWeight: '800',
            color: palette.white,
          }}
        >
          {display}
        </Text>
      </View>
    </Animated.View>
  );
}
