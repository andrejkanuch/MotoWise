import { ExpiringDocumentsDocument } from '@motovault/graphql';
import { EXPIRING_DOCUMENTS_WINDOW_DAYS } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { ChevronRight, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { daysUntilExpiry } from '../../lib/document-expiry';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useEditorialTheme } from '../../theme/editorial';
import { GUTTER, radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';

const ROW_MIN_HEIGHT = 56;

/**
 * Garage section listing soon-expiring documents across active bikes (R11):
 * a section title over native inset rows. Rendered only when ≥1 document is
 * expiring — no empty state. Tapping deep-links to the document.
 */
export function DocumentExpiryAlerts() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const { data } = useQuery({
    queryKey: queryKeys.documents.expiring,
    queryFn: () =>
      gqlFetcher(ExpiringDocumentsDocument, { withinDays: EXPIRING_DOCUMENTS_WINDOW_DAYS }),
  });

  const docs = data?.expiringDocuments ?? [];
  if (docs.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: space.xxl, gap: space.xs }}>
      <Text accessibilityRole="header" style={[type.sectionTitle, { color: theme.ink }]}>
        {t('documents.expiringSoon', { defaultValue: 'Expiring Soon' })}
      </Text>
      <View
        style={{
          backgroundColor: theme.surface,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {docs.map((doc, i) => {
          const days = daysUntilExpiry(doc.expiryDate);
          const overdue = days !== null && days < 0;
          const toneColor = overdue ? theme.overdueInk : theme.dueInk;
          return (
            <Pressable
              key={doc.id}
              onPress={() => {
                triggerImpact(Haptics.ImpactFeedbackStyle.Light);
                trackEvent(AnalyticsEvent.DOCUMENT_EXPIRY_ALERT_TAPPED, {
                  overdue,
                  days_until: days,
                });
                router.push(
                  `/(tabs)/(garage)/document/${doc.id}?motorcycleId=${doc.motorcycleId}` as Href,
                );
              }}
              accessibilityRole="button"
              android_ripple={{ color: theme.line }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                minHeight: ROW_MIN_HEIGHT,
                paddingVertical: space.sm,
                paddingHorizontal: space.md,
                borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                borderTopColor: theme.line,
                backgroundColor:
                  pressed && process.env.EXPO_OS === 'ios' ? theme.surface2 : 'transparent',
              })}
            >
              <TriangleAlert size={18} color={toneColor} strokeWidth={2} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={[type.bodyStrong, { color: theme.ink }]}>
                  {doc.title}
                </Text>
                {days === null ? null : (
                  <Text style={[type.subhead, { color: theme.ink2 }]}>
                    {overdue
                      ? t('documents.expiredDaysAgo', {
                          defaultValue: 'Expired {{days}}d ago',
                          days: Math.abs(days),
                        })
                      : t('documents.expiresInDays', {
                          defaultValue: 'Expires in {{days}}d',
                          days,
                        })}
                  </Text>
                )}
              </View>
              <ChevronRight size={18} color={theme.ink3} strokeWidth={2} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
