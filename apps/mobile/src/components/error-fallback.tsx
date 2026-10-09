import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '../theme/editorial';
import { radius, space, type } from '../theme/type';

type ErrorFallbackProps = {
  error: unknown;
  onRetry: () => void;
};

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const message = __DEV__
    ? error instanceof Error
      ? error.message
      : String(error)
    : t('common.genericError', { defaultValue: 'Something went wrong. Please try again.' });

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.xl,
      }}
    >
      <AlertTriangle
        size={40}
        color={theme.dueInk}
        strokeWidth={1.8}
        style={{ marginBottom: space.md }}
      />
      <Text
        style={{
          ...type.bodyStrong,
          color: theme.ink,
          marginBottom: space.xs,
          textAlign: 'center',
        }}
      >
        {t('common.error', { defaultValue: 'Error' })}
      </Text>
      <Text
        style={{
          ...type.subhead,
          color: theme.ink3,
          marginBottom: space.md,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        android_ripple={{ color: theme.line2 }}
        style={{
          backgroundColor: theme.warm,
          borderRadius: radius.control,
          minHeight: 44,
          justifyContent: 'center',
          paddingHorizontal: space.xl,
          paddingVertical: space.sm,
          borderCurve: 'continuous',
        }}
      >
        <Text style={{ ...type.bodyStrong, color: theme.onWarm }}>
          {t('common.tryAgain', { defaultValue: 'Try Again' })}
        </Text>
      </Pressable>
    </View>
  );
}
