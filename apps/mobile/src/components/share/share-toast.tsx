import { palette } from '@motovault/design-system';
import { Check } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';

interface ShareToastProps {
  message: string | null;
  duration?: number;
}

export function ShareToast({ message, duration = 2000 }: ShareToastProps) {
  const [visible, setVisible] = useState(false);
  const [displayMessage, setDisplayMessage] = useState('');
  const timerRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    if (!message) return;

    // Cancel any previous timer
    timerRef.current?.cancel();

    setDisplayMessage(message);
    setVisible(true);

    let canceled = false;
    const timeoutId = setTimeout(() => {
      if (canceled) return;
      setVisible(false);
    }, duration);

    timerRef.current = {
      cancel: () => {
        canceled = true;
        clearTimeout(timeoutId);
      },
    };

    return () => timerRef.current?.cancel();
  }, [message, duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => timerRef.current?.cancel();
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutDown.duration(200)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 64,
        alignItems: 'center',
        zIndex: 80,
        pointerEvents: 'none',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 12,
          paddingHorizontal: 18,
          borderRadius: 14,
          borderCurve: 'continuous',
          backgroundColor: 'rgba(255,255,255,0.95)',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.4,
          shadowRadius: 32,
          elevation: 12,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            backgroundColor: palette.shareCopper,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Check size={12} color="#fff" strokeWidth={3} />
        </View>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            letterSpacing: -0.07,
            color: palette.shareSheetBg,
          }}
        >
          {displayMessage}
        </Text>
      </View>
    </Animated.View>
  );
}
