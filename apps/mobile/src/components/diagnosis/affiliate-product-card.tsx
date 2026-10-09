import { type AffiliatePartner, TrackAffiliateClickDocument } from '@motovault/graphql';
import { useMutation } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../lib/graphql-client';
import { useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
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
  const { t: theme } = useEditorialTheme();

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
            backgroundColor: theme.surface,
            borderRadius: radius.card,
            padding: space.md,
            borderCurve: 'continuous',
            gap: space.sm,
          }}
        >
          {/* Product info row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
            }}
          >
            <View style={{ flex: 1, gap: space.xxs }}>
              <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={2}>
                {productName}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.xs,
                }}
              >
                {/* Partner badge */}
                <View
                  style={{
                    backgroundColor: theme.surface3,
                    borderRadius: radius.chip,
                    paddingHorizontal: space.xs,
                    paddingVertical: 2,
                    borderCurve: 'continuous',
                  }}
                >
                  <Text style={[type.caption, { fontWeight: '600', color: theme.ink2 }]}>
                    {PARTNER_LABELS[partner] ?? partner}
                  </Text>
                </View>

                {/* Price indicator */}
                {priceIndicator && (
                  <Text style={[type.label, { color: theme.ink2 }]}>{priceIndicator}</Text>
                )}
              </View>
            </View>

            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.chip,
                backgroundColor: theme.surface2,
                alignItems: 'center',
                justifyContent: 'center',
                borderCurve: 'continuous',
              }}
            >
              <ExternalLink size={16} color={theme.warm} strokeWidth={2} />
            </View>
          </View>

          {/* FTC disclosure — visible BEFORE tap */}
          <Text style={[type.caption, { color: theme.ink3 }]}>{t('affiliate.disclosure')}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
