import { palette } from '@motovault/design-system';
import { CheckCircle2, Clock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { ReceiptReviewHandoff, TranslationKey } from './scan-flow-constants';

/**
 * U6→U7c handoff seam.
 *
 * U6 owns the flow up to and including handing a successful `ReceiptScanSuccess`
 * result to the review surface. The real, editable confirmation card is built in
 * **U7c** (`review-card.tsx`) and wired to save/undo in **U7d**. Until then this
 * placeholder renders the extracted fields read-only and offers the two escapes
 * U6 is responsible for: park-for-later (durable + notification) and close.
 *
 * When U7c lands, swap this component for `<ReviewCard handoff={...} />` in
 * `receipt-scan-flow.tsx`'s REVIEW branch — the props contract is `handoff`.
 */
export function ReviewHandoffPlaceholder({
  handoff,
  bikeName,
  isDark,
  onPark,
  onClose,
}: {
  handoff: ReceiptReviewHandoff;
  bikeName: string;
  isDark: boolean;
  onPark: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { result } = handoff;

  const rows: Array<{ labelKey: TranslationKey; value: string | null }> = [
    { labelKey: 'receiptScan.review.type', value: result.type },
    { labelKey: 'receiptScan.review.vendor', value: result.vendor ?? null },
    {
      labelKey: 'receiptScan.review.amount',
      value: result.amount != null ? `${result.amount} ${result.currency ?? ''}`.trim() : null,
    },
    { labelKey: 'receiptScan.review.date', value: result.date ?? null },
  ];

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <CheckCircle2 size={24} color={palette.success500} />
        <Text
          style={{
            fontSize: 22,
            fontWeight: '800',
            color: isDark ? palette.neutral50 : palette.neutral950,
          }}
        >
          {t('receiptScan.review.title')}
        </Text>
      </View>
      <Text style={{ fontSize: 15, color: palette.neutral400, marginBottom: 16 }}>
        {t('receiptScan.review.forBike', { bike: bikeName })}
      </Text>

      <View
        style={{
          borderRadius: 14,
          borderCurve: 'continuous',
          backgroundColor: isDark ? palette.neutral800 : palette.white,
          borderWidth: 1,
          borderColor: isDark ? palette.neutral700 : palette.neutral200,
          padding: 16,
          gap: 12,
        }}
      >
        {rows.map((row) => (
          <View
            key={row.labelKey}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ fontSize: 15, color: palette.neutral400 }}>{t(row.labelKey)}</Text>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: isDark ? palette.neutral50 : palette.neutral900,
              }}
            >
              {row.value ?? t('receiptScan.review.needsCheck')}
            </Text>
          </View>
        ))}
      </View>

      {/* U7c/U7d own the editable card + Save. U6 provides the two escapes. */}
      <View style={{ marginTop: 'auto', paddingBottom: 24, gap: 12 }}>
        <Pressable
          onPress={onPark}
          style={{
            minHeight: 52,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Clock size={18} color={isDark ? palette.neutral50 : palette.neutral900} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              color: isDark ? palette.neutral50 : palette.neutral900,
            }}
          >
            {t('receiptScan.review.reviewLater')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontSize: 15, color: palette.neutral400, fontWeight: '600' }}>
            {t('receiptScan.common.done')}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
