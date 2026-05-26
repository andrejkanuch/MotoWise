import { palette, radii, spacing } from '@motovault/design-system';
import { type AffiliatePartner, TrackAffiliateClickDocument } from '@motovault/graphql';
import { useMutation } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../lib/graphql-client';
import { triggerImpact } from '../../utils/haptics';

const PARTNER_LABELS: Record<string, string> = {
  amazon: 'Amazon',
  revzilla: 'RevZilla',
  rocky_mountain: 'Rocky Mountain ATV/MC',
};

interface AffiliateProductCardProps {
  productName: string;
  productUrl: string;
  partner: AffiliatePartner;
  priceIndicator?: string;
  diagnosisId?: string;
  diagnosisType?: string;
  index?: number;
}

export function AffiliateProductCard({
  productName,
  productUrl,
  partner,
  priceIndicator,
  diagnosisId,
  diagnosisType,
  index = 0,
}: AffiliateProductCardProps) {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const trackClick = useMutation({
    mutationFn: () =>
      gqlFetcher(TrackAffiliateClickDocument, {
        input: {
          partner,
          productUrl,
          diagnosisId,
          diagnosisType,
        },
      }),
  });

  const handlePress = async () => {
    triggerImpact();
    try {
      const result = await trackClick.mutateAsync();
      const url = result.trackAffiliateClick.affiliateUrl || productUrl;
      await Linking.openURL(url);
    } catch {
      // Fallback: open original URL if tracking fails
      await Linking.openURL(productUrl);
    }
  };

  const cardBg = isDark ? palette.cardDark : palette.neutral50;
  const textPrimary = isDark ? palette.neutral50 : palette.neutral950;
  const textSecondary = isDark ? palette.neutral400 : palette.neutral500;
  const borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
  const partnerBg = isDark ? `${palette.primary500}15` : palette.primary50;
  const partnerText = isDark ? palette.primary300 : palette.primary700;

  return (
    <Animated.View entering={FadeInUp.delay(index * 50).duration(400)}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="link"
        accessibilityLabel={`${productName} ${t('affiliate.on')} ${PARTNER_LABELS[partner] ?? partner}`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View
          style={{
            backgroundColor: cardBg,
            borderRadius: 16,
            padding: spacing[4],
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor,
            gap: spacing[3],
          }}
        >
          {/* Product info row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[3],
            }}
          >
            <View style={{ flex: 1, gap: spacing[1] }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: textPrimary,
                  lineHeight: 20,
                }}
                numberOfLines={2}
              >
                {productName}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                }}
              >
                {/* Partner badge */}
                <View
                  style={{
                    backgroundColor: partnerBg,
                    borderRadius: radii.button,
                    paddingHorizontal: spacing[2],
                    paddingVertical: 2,
                    borderCurve: 'continuous',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: partnerText,
                    }}
                  >
                    {PARTNER_LABELS[partner] ?? partner}
                  </Text>
                </View>

                {/* Price indicator */}
                {priceIndicator && (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: isDark ? palette.accent400 : palette.accent500,
                    }}
                  >
                    {priceIndicator}
                  </Text>
                )}
              </View>
            </View>

            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: isDark ? `${palette.primary400}18` : `${palette.primary500}12`,
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}
            >
              <ExternalLink
                size={16}
                color={isDark ? palette.primary300 : palette.primary600}
                strokeWidth={2}
              />
            </View>
          </View>

          {/* FTC disclosure — visible BEFORE tap */}
          <Text
            style={{
              fontSize: 11,
              color: textSecondary,
              lineHeight: 15,
              fontStyle: 'italic',
            }}
          >
            {t('affiliate.disclosure')}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
