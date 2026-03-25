import { createContext, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonContextValue {
  progress: SharedValue<number>;
  isDark: boolean;
}

const SkeletonContext = createContext<SkeletonContextValue | null>(null);

export function SkeletonProvider({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0);
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  return (
    <SkeletonContext.Provider value={{ progress, isDark }}>{children}</SkeletonContext.Provider>
  );
}

export function useSkeletonContext() {
  const ctx = useContext(SkeletonContext);
  if (!ctx) throw new Error('Skeleton must be wrapped in SkeletonProvider');
  return ctx;
}

/** @deprecated Use useSkeletonContext().progress instead */
export function useSkeletonProgress() {
  return useSkeletonContext().progress;
}
