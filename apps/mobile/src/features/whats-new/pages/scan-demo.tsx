/**
 * Scan a receipt demo: a clean data card, not a paper receipt. A copper scan
 * line passes over it, then the place, category, total and date fill in one
 * after another. The rider's latest expense shows in its own currency; the
 * example is a fuel fill in the rider's currency. Under reduced motion the card
 * is shown filled and the scan line is left out. Decorative: the page line says
 * the same in words.
 */

import { type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { WHATS_NEW_DATA_KIND } from '@/data/whats-new-releases';
import { categoryLabel } from '@/lib/expense-constants';
import { useEditorialTheme } from '@/theme/editorial';
import { layout, space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import type { ScanPageData } from '../build-boot-snapshot';

const SCAN_LINE_HEIGHT = 2;
const SCAN_DELAY_MS = 400;
const SCAN_MS = 1100;
const FILL_DELAY_MS = 900;
const FILL_STAGGER_MS = 240;
const FILL_MS = 220;
const SCAN_EASING = Easing.bezier(0.45, 0, 0.55, 1);

function FillIn({
  index,
  reduceMotion,
  children,
}: {
  index: number;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withDelay(
      FILL_DELAY_MS + index * FILL_STAGGER_MS,
      withTiming(1, { duration: FILL_MS }),
    );
  }, [opacity, index, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function ScanLine({ travel, color }: { travel: number; color: string }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    y.value = withDelay(
      SCAN_DELAY_MS,
      withTiming(travel, { duration: SCAN_MS, easing: SCAN_EASING }),
    );
    opacity.value = withDelay(SCAN_DELAY_MS + SCAN_MS, withTiming(0, { duration: FILL_MS }));
  }, [y, opacity, travel]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));
  return (
    <Animated.View
      testID="whats-new-scan-line"
      style={[
        { position: 'absolute', left: 0, right: 0, top: 0, height: SCAN_LINE_HEIGHT },
        { backgroundColor: color },
        style,
      ]}
    />
  );
}

export function ScanDemo({ data, reduceMotion }: { data: ScanPageData; reduceMotion: boolean }) {
  const { t: tr } = useTranslation();
  const { t } = useEditorialTheme();
  const [height, setHeight] = useState(0);
  const mine = data.kind === WHATS_NEW_DATA_KIND.YOUR_DATA;

  const fields = [
    {
      label: tr('whatsNew.features.receipt_scan.demo.place'),
      value: mine ? data.place : tr('whatsNew.features.receipt_scan.demo.examplePlace'),
    },
    {
      label: tr('whatsNew.features.receipt_scan.demo.category'),
      value: mine
        ? categoryLabel(tr, data.category)
        : tr('whatsNew.features.receipt_scan.demo.fuel'),
    },
    { label: tr('whatsNew.features.receipt_scan.demo.total'), value: data.amount },
    { label: tr('whatsNew.features.receipt_scan.demo.date'), value: data.date },
  ];

  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);

  return (
    <View style={{ flex: 1, padding: space.md, justifyContent: 'center' }}>
      <View
        onLayout={onLayout}
        style={{
          borderRadius: radius.card,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: t.line,
          backgroundColor: t.surface2,
          padding: space.md,
          gap: layout.fieldGap,
          overflow: 'hidden',
        }}
      >
        <Text style={[type.label, { color: t.ink3 }]}>
          {mine
            ? tr('whatsNew.features.receipt_scan.demo.headerYourData')
            : tr('whatsNew.features.receipt_scan.demo.headerExample')}
        </Text>
        {fields.map((field, index) => (
          <View key={field.label} style={{ gap: layout.titleGap }}>
            <Text style={[type.caption, { color: t.ink3 }]}>{field.label}</Text>
            <FillIn index={index} reduceMotion={reduceMotion}>
              <Text numberOfLines={1} style={[type.bodyStrong, { color: t.ink }]}>
                {field.value}
              </Text>
            </FillIn>
          </View>
        ))}
        {reduceMotion ? null : <ScanLine travel={height} color={t.warm} />}
      </View>
    </View>
  );
}
