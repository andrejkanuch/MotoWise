import { palette } from '@motovault/design-system';
import { onlineManager } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';

export function HudOfflineBanner() {
  const [isOffline, setIsOffline] = useState(!onlineManager.isOnline());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const unsub = onlineManager.subscribe((isOnline) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setIsOffline(!isOnline), 500);
    });
    return () => {
      unsub();
      clearTimeout(debounceRef.current);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: palette.warningBgDark,
        borderRadius: 12,
        borderCurve: 'continuous',
        marginHorizontal: 16,
        marginBottom: 8,
      }}
    >
      <WifiOff size={14} color={palette.warning500} />
      <Text style={{ fontSize: 13, fontWeight: '600', color: palette.warning500 }}>
        Offline — ride is still recording
      </Text>
    </Animated.View>
  );
}
