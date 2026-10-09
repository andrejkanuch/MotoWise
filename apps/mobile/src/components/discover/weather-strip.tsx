import { Sun } from 'lucide-react-native';
import { memo } from 'react';
import { Text, View } from 'react-native';
import { useWeatherForecast } from '../../hooks/use-weather-forecast';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { type } from '../../theme/type';

export const WeatherStrip = memo(function WeatherStrip() {
  const { enabled, data, isLoading } = useWeatherForecast();
  const { t } = useEditorialTheme();

  // Weather is switched off (WEATHER_ENABLED, issue 272) or not ready: render nothing.
  if (!enabled || isLoading || !data?.headline) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 10,
        backgroundColor: tint(t.success, 0.1),
        borderWidth: 1,
        borderColor: tint(t.success, 0.2),
        borderRadius: 999,
      }}
    >
      <Sun size={12} color={t.success} />
      <Text style={[type.caption, { color: t.success }]} numberOfLines={1}>
        {data.headline}
      </Text>
    </View>
  );
});
