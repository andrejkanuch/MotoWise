import { palette } from '@motovault/design-system';
import { ExpiringDocumentsDocument } from '@motovault/graphql';
import { EXPIRING_DOCUMENTS_WINDOW_DAYS } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { ChevronRight, TriangleAlert } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { ECard, ESectionMasthead } from '../ui/editorial';

interface DocumentExpiryAlertsProps {
  isDark: boolean;
}

/**
 * Garage summary surface listing soon-expiring documents across active bikes
 * (R11). Rendered only when ≥1 document is expiring — no empty-state card.
 * Tapping deep-links to the document.
 */
export function DocumentExpiryAlerts({ isDark }: DocumentExpiryAlertsProps) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: queryKeys.documents.expiring,
    queryFn: () =>
      gqlFetcher(ExpiringDocumentsDocument, { withinDays: EXPIRING_DOCUMENTS_WINDOW_DAYS }),
  });

  const docs = data?.expiringDocuments ?? [];
  if (docs.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
      <ESectionMasthead label={t('documents.expiringSoon', { defaultValue: 'Expiring Soon' })} />
      <ECard pad={0}>
        {docs.map((doc, i) => {
          const days = doc.expiryDate
            ? differenceInCalendarDays(parseISO(doc.expiryDate), new Date())
            : null;
          const overdue = days !== null && days < 0;
          return (
            <Pressable
              key={doc.id}
              onPress={() => {
                if (process.env.EXPO_OS === 'ios') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                trackEvent(AnalyticsEvent.DOCUMENT_EXPIRY_ALERT_TAPPED, {
                  overdue,
                  days_until: days,
                });
                router.push(
                  `/(tabs)/(garage)/document/${doc.id}?motorcycleId=${doc.motorcycleId}` as Href,
                );
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 13,
                paddingHorizontal: 16,
                borderTopWidth: i === 0 ? 0 : 0.5,
                borderTopColor: isDark ? palette.neutral800 : palette.neutral200,
              }}
            >
              <TriangleAlert
                size={18}
                color={overdue ? palette.danger500 : palette.warning500}
                strokeWidth={2}
              />
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: isDark ? palette.neutral100 : palette.neutral900,
                  }}
                >
                  {doc.title}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: overdue ? palette.danger500 : palette.warning500,
                  }}
                >
                  {days === null
                    ? ''
                    : overdue
                      ? t('documents.expiredDaysAgo', {
                          defaultValue: 'Expired {{days}}d ago',
                          days: Math.abs(days),
                        })
                      : t('documents.expiresInDays', {
                          defaultValue: 'Expires in {{days}}d',
                          days,
                        })}
                </Text>
              </View>
              <ChevronRight size={18} color={palette.neutral400} strokeWidth={2} />
            </Pressable>
          );
        })}
      </ECard>
    </View>
  );
}
