/**
 * One What's New page: title with the Tried chip, the rider's line, the demo
 * panel tagged YOUR DATA or EXAMPLE, where the feature lives, and the one
 * copper button that opens it. The line and button differ for the rider's own
 * data and for an example. A page the rider has not reached yet shows only its
 * title, so its data is read the moment it is first viewed.
 *
 * The demo is hidden from screen readers; the tag and the line carry it.
 */

import type { TFunction } from 'i18next';
import { Check } from 'lucide-react-native';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import {
  WHATS_NEW_DATA_KIND,
  WHATS_NEW_FEATURE,
  WHATS_NEW_FEATURES,
  type WhatsNewFeature,
} from '@/data/whats-new-releases';
import { useEditorialTheme } from '@/theme/editorial';
import { layout, space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import { ATLAS_LINE, type WhatsNewPageData } from './build-boot-snapshot';
import { AtlasDemo } from './pages/atlas-demo';
import { NotesDemo } from './pages/notes-demo';
import { ScanDemo } from './pages/scan-demo';

/** Minimum touch target, in points. */
export const MIN_TARGET = 44;
const CTA_HEIGHT = 52;
const TRIED_ICON = 14;
const TRIED_STROKE = 2.8;
const DATA_TAG_TRACKING = 0.6;

/** The page's personal line, worded for the rider's data or for an example. */
function pageLine(t: TFunction, data: WhatsNewPageData): string {
  switch (data.feature) {
    case WHATS_NEW_FEATURE.ROAD_ATLAS:
      if (data.kind === WHATS_NEW_DATA_KIND.EXAMPLE) {
        return t('whatsNew.features.road_atlas.example.line');
      }
      if (data.line === ATLAS_LINE.LAST_RIDES || !data.distance) {
        return t('whatsNew.features.road_atlas.yourData.lineLastRides', { count: data.rides });
      }
      if (data.line === ATLAS_LINE.SEASON_WITH_SHARE && data.newRoadShare) {
        return t('whatsNew.features.road_atlas.yourData.lineWithShare', {
          share: data.newRoadShare,
          distance: data.distance,
        });
      }
      return t('whatsNew.features.road_atlas.yourData.line', {
        distance: data.distance,
        count: data.rides,
      });
    case WHATS_NEW_FEATURE.RECEIPT_SCAN:
      return data.kind === WHATS_NEW_DATA_KIND.YOUR_DATA
        ? t('whatsNew.features.receipt_scan.yourData.line', {
            date: data.date,
            place: data.place,
            amount: data.amount,
          })
        : t('whatsNew.features.receipt_scan.example.line');
    case WHATS_NEW_FEATURE.NOTES_PHOTOS:
      if (data.kind === WHATS_NEW_DATA_KIND.YOUR_DATA) {
        return t('whatsNew.features.notes_photos.yourData.line', { note: data.text });
      }
      return data.bikeName
        ? t('whatsNew.features.notes_photos.example.line', { bike: data.bikeName })
        : t('whatsNew.features.notes_photos.example.lineNoBike');
  }
}

function Demo({ data, reduceMotion }: { data: WhatsNewPageData; reduceMotion: boolean }) {
  switch (data.feature) {
    case WHATS_NEW_FEATURE.ROAD_ATLAS:
      return <AtlasDemo data={data} reduceMotion={reduceMotion} />;
    case WHATS_NEW_FEATURE.RECEIPT_SCAN:
      return <ScanDemo data={data} reduceMotion={reduceMotion} />;
    case WHATS_NEW_FEATURE.NOTES_PHOTOS:
      return <NotesDemo data={data} reduceMotion={reduceMotion} />;
  }
}

export interface WhatsNewPageProps {
  feature: WhatsNewFeature;
  /** Null until the rider first reaches the page. */
  data: WhatsNewPageData | null;
  tried: boolean;
  width: number;
  reduceMotion: boolean;
  titleRef?: Ref<Text>;
  onTry: () => void;
}

export function WhatsNewPage({
  feature,
  data,
  tried,
  width,
  reduceMotion,
  titleRef,
  onTry,
}: WhatsNewPageProps) {
  const { t: tr } = useTranslation();
  const { t } = useEditorialTheme();
  const meta = WHATS_NEW_FEATURES[feature];
  const mine = data?.kind === WHATS_NEW_DATA_KIND.YOUR_DATA;
  const cta = tried
    ? tr('whatsNew.carousel.openAgain')
    : tr(mine ? meta.keys.yourData.cta : meta.keys.example.cta);

  return (
    <View
      style={{
        width,
        flex: 1,
        paddingHorizontal: layout.screenGutter,
        paddingTop: space.xs,
        gap: layout.fieldGap,
      }}
    >
      <View style={{ gap: layout.labelGap }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}
        >
          <Text
            ref={titleRef}
            accessibilityRole="header"
            style={[type.largeTitle, { color: t.ink }]}
          >
            {tr(meta.keys.title)}
          </Text>
          {tried ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
              <Check size={TRIED_ICON} color={t.success} strokeWidth={TRIED_STROKE} />
              <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: t.success }]}>
                {tr('whatsNew.carousel.tried')}
              </Text>
            </View>
          ) : null}
        </View>
        {data ? <Text style={[type.body, { color: t.ink2 }]}>{pageLine(tr, data)}</Text> : null}
      </View>

      <View
        style={{
          flex: 1,
          borderRadius: radius.plate,
          borderCurve: 'continuous',
          backgroundColor: t.surface,
          overflow: 'hidden',
        }}
      >
        {data ? (
          <>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ flex: 1 }}
            >
              <Demo data={data} reduceMotion={reduceMotion} />
            </View>
            <View
              style={{
                position: 'absolute',
                right: space.sm,
                bottom: space.sm,
                paddingHorizontal: space.xs,
                paddingVertical: space.xxs,
                borderRadius: radius.chip,
                borderCurve: 'continuous',
                backgroundColor: mine ? t.ink : t.surface3,
              }}
            >
              <Text
                style={[
                  type.caption,
                  SYSTEM_WEIGHT.bold,
                  { letterSpacing: DATA_TAG_TRACKING, color: mine ? t.bg : t.ink },
                ]}
              >
                {mine ? tr('whatsNew.carousel.yourData') : tr('whatsNew.carousel.example')}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      <View style={{ gap: layout.titleGap }}>
        <Text style={[type.caption, SYSTEM_WEIGHT.semibold, { color: t.ink3 }]}>
          {tr('whatsNew.carousel.whereItLives')}
        </Text>
        <Text style={[type.label, { color: t.ink2 }]}>{tr(meta.keys.where)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onTry}
        disabled={!data}
        style={({ pressed }) => ({
          minHeight: CTA_HEIGHT,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: t.warm,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: space.md,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={[type.bodyStrong, { color: t.onWarm }]}>{cta}</Text>
      </Pressable>
    </View>
  );
}
