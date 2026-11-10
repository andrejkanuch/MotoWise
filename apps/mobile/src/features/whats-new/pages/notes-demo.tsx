/**
 * Notes + photos demo: the note's text fades in, a dashed "Add a photo" slot
 * pops in beside it, then the search field fills with a word from the note and
 * the note is marked as found. The rider's latest note on the primary bike, or
 * an example tire-pressure note in the rider's units. Under reduced motion it
 * is shown finished. Decorative: the page line says the same in words.
 */

import { Camera, Search } from 'lucide-react-native';
import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { WHATS_NEW_DATA_KIND } from '@/data/whats-new-releases';
import { useEditorialTheme } from '@/theme/editorial';
import { layout, space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import type { NotesPageData } from '../build-boot-snapshot';

const TEXT_DELAY_MS = 200;
const SLOT_DELAY_MS = 900;
const SEARCH_DELAY_MS = 1600;
const FOUND_DELAY_MS = 2000;
const STEP_MS = 260;
const PHOTO_SLOT = 88;
const SLOT_ICON = 22;
const SEARCH_ICON = 16;
const DASHED_BORDER = 1.5;
const FOUND_BORDER = 2;

function Appear({
  delay,
  reduceMotion,
  children,
}: {
  delay: number;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withDelay(delay, withTiming(1, { duration: STEP_MS }));
  }, [opacity, delay, reduceMotion]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The first word of the note, as a rider would search for it. */
function searchWord(text: string): string {
  return text.split(/\s+/).find((word) => word.length > 0) ?? text;
}

export function NotesDemo({ data, reduceMotion }: { data: NotesPageData; reduceMotion: boolean }) {
  const { t: tr } = useTranslation();
  const { t } = useEditorialTheme();
  const note =
    data.kind === WHATS_NEW_DATA_KIND.YOUR_DATA
      ? data.text
      : tr('whatsNew.features.notes_photos.demo.exampleNote', {
          front: data.front,
          rear: data.rear,
        });

  const found = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    found.value = withDelay(FOUND_DELAY_MS, withTiming(1, { duration: STEP_MS }));
  }, [found, reduceMotion]);
  const foundStyle = useAnimatedStyle(() => ({ opacity: found.value }));

  return (
    <View style={{ flex: 1, padding: space.md, gap: layout.fieldGap, justifyContent: 'center' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          paddingHorizontal: space.sm,
          paddingVertical: space.xs,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          backgroundColor: t.surface2,
        }}
      >
        <Search size={SEARCH_ICON} color={t.ink3} />
        <View style={{ flex: 1 }}>
          <Text style={[type.subhead, { color: t.ink3 }]}>
            {tr('whatsNew.features.notes_photos.demo.searchPlaceholder')}
          </Text>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
            <Appear delay={SEARCH_DELAY_MS} reduceMotion={reduceMotion}>
              <Text style={[type.subhead, { color: t.ink, backgroundColor: t.surface2 }]}>
                {searchWord(note)}
              </Text>
            </Appear>
          </View>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: space.sm,
          padding: space.sm,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: t.surface2,
        }}
      >
        <Appear delay={SLOT_DELAY_MS} reduceMotion={reduceMotion}>
          <View
            style={{
              width: PHOTO_SLOT,
              height: PHOTO_SLOT,
              borderRadius: radius.chip,
              borderCurve: 'continuous',
              borderWidth: DASHED_BORDER,
              borderStyle: 'dashed',
              borderColor: t.warm,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xxs,
            }}
          >
            <Camera size={SLOT_ICON} color={t.warm2} />
            <Text style={[type.caption, { color: t.warm2, textAlign: 'center' }]}>
              {tr('whatsNew.features.notes_photos.demo.addPhoto')}
            </Text>
          </View>
        </Appear>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Appear delay={TEXT_DELAY_MS} reduceMotion={reduceMotion}>
            <Text style={[type.body, { color: t.ink }]}>{note}</Text>
          </Appear>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              borderWidth: FOUND_BORDER,
              borderColor: t.ink,
            },
            foundStyle,
          ]}
        />
      </View>

      <Appear delay={FOUND_DELAY_MS} reduceMotion={reduceMotion}>
        <Text style={[type.label, { color: t.ink2 }]}>
          {tr('whatsNew.features.notes_photos.demo.foundBySearch')}
        </Text>
      </Appear>
    </View>
  );
}
