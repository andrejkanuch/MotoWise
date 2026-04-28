import { palette } from '@motovault/design-system';
import { Sun } from 'lucide-react-native';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { useWeatherForecast } from '../../hooks/use-weather-forecast';

export const WeatherStrip = memo(function WeatherStrip() {
  const { data, isLoading } = useWeatherForecast();

  if (isLoading || !data?.headline) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(78,186,111,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(78,186,111,0.20)',
        borderRadius: 999,
      }}
    >
      <Sun size={12} color={palette.editorialSuccess} />
      <Text
        style={{
          fontSize: 11.5,
          fontWeight: '500',
          color: palette.editorialSuccess,
        }}
        numberOfLines={1}
      >
        {data.headline}
      </Text>
    </View>
  );
});
