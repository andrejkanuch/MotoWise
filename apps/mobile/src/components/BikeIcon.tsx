import { Bike } from 'lucide-react-native';
import { View } from 'react-native';

type BikeIconProps = {
  variant?: string;
  size?: number;
  color?: string;
};

export function BikeIcon({ size = 48, color = '#3366e6' }: BikeIconProps) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Bike size={size * 0.7} color={color} strokeWidth={1.5} />
    </View>
  );
}
