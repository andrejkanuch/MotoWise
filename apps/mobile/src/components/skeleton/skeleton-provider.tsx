import { createContext, useContext, useEffect } from 'react';
import {
  cancelAnimation,
  Easing,
  type SharedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SkeletonContext = createContext<SharedValue<number> | null>(null);

export function SkeletonProvider({ children }: { children: React.ReactNode }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  return <SkeletonContext.Provider value={progress}>{children}</SkeletonContext.Provider>;
}

export function useSkeletonProgress() {
  const ctx = useContext(SkeletonContext);
  if (!ctx) throw new Error('Skeleton must be wrapped in SkeletonProvider');
  return ctx;
}
