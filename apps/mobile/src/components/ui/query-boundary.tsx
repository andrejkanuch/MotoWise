import { RotateCw } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { tint, useEditorialTheme } from '../../theme/editorial';

interface QueryBoundaryProps {
  /** TanStack Query `isLoading` (or `isPending`). */
  isLoading: boolean;
  /** TanStack Query `isError`. */
  isError: boolean;
  /** Render the empty state instead of children (e.g. zero results). */
  isEmpty?: boolean;
  /** Called when the user taps "Retry" in the error state (usually `refetch`). */
  onRetry?: () => void;
  /** Message shown in the error state; falls back to a generic copy. */
  errorMessage?: string;
  /** Rendered when `isEmpty` is true. */
  emptyState?: ReactNode;
  /** Overrides the default centered spinner. */
  loadingState?: ReactNode;
  /** Fill the parent (flex: 1) for screen-level use. When false, uses `minHeight`. */
  fill?: boolean;
  /** Minimum height for the centered states when `fill` is false. */
  minHeight?: number;
  children: ReactNode;
}

/**
 * Wraps a data-driven subtree and renders loading / error+retry / empty states
 * from TanStack Query flags, so screens don't hand-roll (and routinely forget)
 * the `isError` branch. Flat guard clauses — loading wins, then error, then
 * empty, then the real content.
 */
export function QueryBoundary({
  isLoading,
  isError,
  isEmpty = false,
  onRetry,
  errorMessage,
  emptyState,
  loadingState,
  fill = true,
  minHeight = 240,
  children,
}: QueryBoundaryProps) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();

  const centered = fill
    ? ({ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 } as const)
    : ({ minHeight, alignItems: 'center', justifyContent: 'center', padding: 24 } as const);

  if (isLoading) {
    if (loadingState) return <>{loadingState}</>;
    return (
      <View style={centered}>
        <ActivityIndicator color={theme.warm} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={[centered, { gap: 14 }]}>
        <Text style={{ fontSize: 14, color: theme.ink2, textAlign: 'center', maxWidth: 280 }}>
          {errorMessage ??
            t('common.genericError', { defaultValue: 'Something went wrong. Please try again.' })}
        </Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingVertical: 10,
              paddingHorizontal: 18,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: tint(theme.warm, 0.14),
            }}
          >
            <RotateCw size={15} color={theme.warm} strokeWidth={2.2} />
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.warm }}>
              {t('common.retry', { defaultValue: 'Retry' })}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (isEmpty) return <>{emptyState ?? null}</>;

  return <>{children}</>;
}
