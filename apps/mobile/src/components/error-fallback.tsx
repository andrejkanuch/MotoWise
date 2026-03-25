import { palette } from '@motovault/design-system';
import { AlertTriangle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useColorScheme, View } from 'react-native';

type ErrorFallbackProps = {
  error: unknown;
  onRetry: () => void;
};

export function ErrorFallback({ error, onRetry }: ErrorFallbackProps) {
  const message = error instanceof Error ? error.message : String(error);
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: isDark ? palette.neutral950 : palette.neutral50,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
      }}
    >
      <AlertTriangle
        size={40}
        color={palette.warning500}
        strokeWidth={1.8}
        style={{ marginBottom: 16 }}
      />
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: isDark ? palette.neutral50 : palette.neutral950,
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        {t('common.error', { defaultValue: 'Error' })}
      </Text>
      <Text
        style={{
          fontSize: 14,
          color: isDark ? palette.neutral400 : palette.neutral500,
          marginBottom: 16,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
      <Pressable
        onPress={onRetry}
        style={{
          backgroundColor: isDark ? palette.primary500 : palette.primary950,
          borderRadius: 12,
          paddingHorizontal: 24,
          paddingVertical: 12,
          borderCurve: 'continuous',
        }}
      >
        <Text style={{ color: palette.white, fontSize: 16, fontWeight: '600' }}>
          {t('common.tryAgain', { defaultValue: 'Try Again' })}
        </Text>
      </Pressable>
    </View>
  );
}
