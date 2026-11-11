/**
 * What's New: on auto-show a short instrument boot, then one swipeable page
 * per feature with Back / dots / Next ("Ride on" on the last page).
 *
 * - Auto-show marks the release and its page features seen the moment the
 *   pages are fixed, which is on mount once the snapshot has read the cache, so
 *   swiping it away or killing the app never brings it back.
 * - The page set is fixed once. Auto-show picks the release's features plus the
 *   catch-up features the rider has neither been shown nor used (prior use read
 *   from the snapshot counts as used). Profile and the way back from a feature
 *   show the release's full set.
 * - A page's data is read, and frozen, the first time the rider reaches it.
 * - A feature opened on top of this screen (the scan) can ask it to move on to
 *   the page after that feature when the rider picks "Next feature" there.
 * - Close and "Ride on" leave with one `router.back()` and end the visit, so
 *   feature screens stop offering the way back.
 */

import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  WHATS_NEW_MIN_TARGET as MIN_TARGET,
  WHATS_NEW_EXPERIMENT,
  WHATS_NEW_SOURCE,
  type WhatsNewSource,
} from '@/config/whats-new';
import {
  WHATS_NEW_FEATURES,
  WHATS_NEW_TAG,
  type WhatsNewDataKind,
  type WhatsNewFeature,
} from '@/data/whats-new-releases';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import {
  installedRelease,
  NOTHING_SEEN,
  type WhatsNewPage as PageEntry,
  selectPages,
} from '@/lib/whats-new';
import { useWhatsNewStore } from '@/stores/whats-new.store';
import { useEditorialTheme } from '@/theme/editorial';
import { layout, space } from '@/theme/spacing';
import { radius, SYSTEM_WEIGHT, type } from '@/theme/type';
import { triggerImpact } from '@/utils/haptics';
import { useBootSnapshot } from './use-boot-snapshot';
import { WhatsNewBoot, type WhatsNewBootResult } from './whats-new-boot';
import { WhatsNewPage } from './whats-new-page';

/** Opens a page's feature: the feature, the page it was opened from, and which data the page showed. */
export type TryFeature = (
  feature: WhatsNewFeature,
  pageIndex: number,
  dataKind: WhatsNewDataKind,
) => void;

export interface WhatsNewScreenParams {
  source: WhatsNewSource;
  /** The page to open on, when coming back from a feature. */
  resume: number | null;
  /** Leave out the boot even on auto-show. */
  noBoot: boolean;
}

export interface WhatsNewScreenProps extends WhatsNewScreenParams {
  onTryFeature?: TryFeature;
}

type RawParams = Record<string, string | string[] | undefined>;

const SOURCES: readonly string[] = Object.values(WHATS_NEW_SOURCE);
const TRUE_FLAGS: readonly string[] = ['1', 'true'];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Route params as the screen reads them. A missing or unknown source opens like Profile. */
export function whatsNewParams(raw: RawParams): WhatsNewScreenParams {
  const source = first(raw.source);
  const resume = Number.parseInt(first(raw.resume) ?? '', 10);
  return {
    source:
      source && SOURCES.includes(source) ? (source as WhatsNewSource) : WHATS_NEW_SOURCE.PROFILE,
    resume: Number.isInteger(resume) && resume >= 0 ? resume : null,
    noBoot: TRUE_FLAGS.includes(first(raw.noBoot) ?? ''),
  };
}

const PHASE = { BOOT: 'boot', PAGES: 'pages' } as const;
type Phase = (typeof PHASE)[keyof typeof PHASE];

const DOT_SIZE = 8;
const DOT_CURRENT_WIDTH = 22;
const CLOSE_ICON = 18;
const NAV_ICON = 18;
const PRESSED_OPACITY = 0.6;
const noop: TryFeature = () => {};

/** "3.28" for a .0 patch, the full version otherwise. */
function displayVersion(version: string): string {
  return version.replace(/\.0$/, '');
}

export function WhatsNewScreen({
  source,
  resume,
  noBoot,
  onTryFeature = noop,
}: WhatsNewScreenProps) {
  const { t: tr } = useTranslation();
  const { t } = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const handle = useBootSnapshot();
  const triedFeatures = useWhatsNewStore((s) => s.triedFeatures);
  const setReturnSessionOpen = useWhatsNewStore((s) => s.setReturnSessionOpen);
  const nextAfter = useWhatsNewStore((s) => s.nextAfter);

  const release = useMemo(installedRelease, []);
  const [pages, setPages] = useState<PageEntry[] | null>(null);
  const [phase, setPhase] = useState<Phase>(
    source === WHATS_NEW_SOURCE.AUTO && !noBoot && resume === null ? PHASE.BOOT : PHASE.PAGES,
  );
  const [page, setPage] = useState(resume ?? 0);
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set());
  const seenRef = useRef(new Set<number>());
  const scrollRef = useRef<ScrollView>(null);
  const titleRefs = useRef<(Text | null)[]>([]);
  const previousPage = useRef<number | null>(null);
  const closing = useRef(false);
  // Initial only: re-applying it on every page change would cut the animated scroll short.
  const initialOffset = useRef({ x: (resume ?? 0) * width, y: 0 });

  const count = pages?.length ?? 0;
  const current = Math.min(page, Math.max(count - 1, 0));

  // Fix the page set once the snapshot has read the cache; auto-show marks the release seen here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, when the snapshot is ready.
  useEffect(() => {
    if (pages || !handle.ready) return;
    const store = useWhatsNewStore.getState();
    // Features the rider already used on this account count as used here too: no catch-up page, no NEW chip.
    for (const feature of handle.priorUse) store.markUsed(feature);
    const fixed =
      source === WHATS_NEW_SOURCE.AUTO
        ? selectPages(release, {
            seenFeatures: store.seenFeatures,
            usedFeatures: [...store.usedFeatures, ...handle.priorUse],
          })
        : selectPages(release, NOTHING_SEEN);
    setPages(fixed);
    store.setVisitPages(fixed.map((entry) => entry.feature));
    if (source === WHATS_NEW_SOURCE.AUTO) {
      store.markReleaseSeen(
        release.version,
        fixed.map((entry) => entry.feature),
      );
    }
    if (source !== WHATS_NEW_SOURCE.RETURN) {
      const holdout = store.holdout;
      trackEvent(AnalyticsEvent.WHATS_NEW_VIEWED, {
        version: release.version,
        source,
        pages: fixed.length,
        ...(holdout?.experimentKey === WHATS_NEW_EXPERIMENT.EXPERIMENT_KEY
          ? { arm: holdout.arm }
          : {}),
      });
    }
  }, [handle.ready]);

  // First view of a page: freeze its data and log it.
  useEffect(() => {
    if (!pages || phase !== PHASE.PAGES || seenRef.current.has(current)) return;
    const entry = pages[current];
    const data = handle.getPageData(entry.feature);
    if (!data) return;
    seenRef.current.add(current);
    setSeen(new Set(seenRef.current));
    trackEvent(AnalyticsEvent.WHATS_NEW_PAGE_VIEWED, {
      version: release.version,
      feature: entry.feature,
      page_index: current,
      data_kind: data.kind,
      data_source: data.source,
      tag: entry.tag,
    });
  }, [pages, phase, current, handle, release.version]);

  // Announce a page change and move focus to its title (not on the first page shown).
  useEffect(() => {
    if (!pages || phase !== PHASE.PAGES) return;
    const before = previousPage.current;
    previousPage.current = current;
    if (before === null || before === current) return;
    AccessibilityInfo.announceForAccessibility(
      tr('whatsNew.carousel.pageAnnouncement', {
        current: current + 1,
        total: pages.length,
        title: tr(WHATS_NEW_FEATURES[pages[current].feature].keys.title),
      }),
    );
    const title = titleRefs.current[current];
    if (title) AccessibilityInfo.sendAccessibilityEvent(title, 'focus');
  }, [pages, phase, current, tr]);

  // Coming back to a page: jump there without animating.
  useEffect(() => {
    if (resume === null || !pages) return;
    const target = Math.min(resume, pages.length - 1);
    setPage(target);
    scrollRef.current?.scrollTo({ x: target * width, animated: false });
  }, [resume, pages, width]);

  // A feature opened on top of this screen asked for the page after it.
  useEffect(() => {
    if (!nextAfter || !pages) return;
    useWhatsNewStore.getState().setNextAfter(null);
    const from = pages.findIndex((entry) => entry.feature === nextAfter);
    if (from < 0) return;
    const target = Math.min(from + 1, pages.length - 1);
    setPage(target);
    scrollRef.current?.scrollTo({ x: target * width, animated: false });
  }, [nextAfter, pages, width]);

  const goTo = (index: number) => {
    triggerImpact();
    setPage(index);
    scrollRef.current?.scrollTo({ x: index * width, animated: !reduceMotion });
  };

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== page) setPage(index);
  };

  const onBootDone = useCallback(({ skipped, elapsedMs }: WhatsNewBootResult) => {
    if (skipped) trackEvent(AnalyticsEvent.WHATS_NEW_BOOT_SKIPPED, { elapsed_ms: elapsedMs });
    setPhase(PHASE.PAGES);
  }, []);

  const close = () => {
    if (!pages || closing.current) return;
    closing.current = true;
    const completedAll = current === pages.length - 1;
    if (!completedAll) {
      trackEvent(AnalyticsEvent.WHATS_NEW_SKIPPED, {
        version: release.version,
        skipped_at_page: current,
        total_pages: pages.length,
      });
    }
    trackEvent(AnalyticsEvent.WHATS_NEW_DISMISSED, {
      version: release.version,
      last_page: current,
      completed_all: completedAll,
      tried_count: pages.filter((entry) => triedFeatures.includes(entry.feature)).length,
    });
    setReturnSessionOpen(false);
    const store = useWhatsNewStore.getState();
    store.setVisitPages(null);
    store.setNextAfter(null);
    router.back();
  };

  if (!pages || !handle.boot) return <View style={{ flex: 1, backgroundColor: t.bg }} />;

  if (phase === PHASE.BOOT) {
    const newCount = pages.filter((entry) => entry.tag === WHATS_NEW_TAG.NEW).length;
    return (
      <WhatsNewBoot
        boot={handle.boot}
        newCount={newCount}
        catchUpCount={pages.length - newCount}
        onDone={onBootDone}
      />
    );
  }

  const entry = pages[current];
  const isLast = current === pages.length - 1;
  const several = pages.length > 1;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: insets.top + space.xs,
          paddingHorizontal: layout.screenGutter,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 }}>
          <View
            style={{
              paddingHorizontal: space.xs,
              paddingVertical: space.xxs,
              borderRadius: radius.chip,
              borderCurve: 'continuous',
              backgroundColor: t.surface3,
            }}
          >
            <Text style={[type.caption, SYSTEM_WEIGHT.bold, { color: t.ink }]}>
              {entry.tag === WHATS_NEW_TAG.NEW
                ? tr('whatsNew.carousel.tagNew', { version: displayVersion(release.version) })
                : tr('whatsNew.carousel.tagCatchUp')}
            </Text>
          </View>
          {several ? (
            <Text testID="whats-new-page-of" style={[type.label, { color: t.ink3 }]}>
              {tr('whatsNew.carousel.pageOf', { current: current + 1, total: pages.length })}
            </Text>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr('whatsNew.carousel.close')}
          onPress={close}
          style={({ pressed }) => ({
            width: MIN_TARGET,
            height: MIN_TARGET,
            borderRadius: radius.pill,
            backgroundColor: t.surface2,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? PRESSED_OPACITY : 1,
          })}
        >
          <X size={CLOSE_ICON} color={t.ink} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={initialOffset.current}
        onLayout={() => scrollRef.current?.scrollTo({ x: current * width, animated: false })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        style={{ flex: 1, marginTop: layout.fieldGap }}
      >
        {pages.map((item, index) => (
          <WhatsNewPage
            key={item.feature}
            feature={item.feature}
            data={seen.has(index) ? handle.getPageData(item.feature) : null}
            tried={triedFeatures.includes(item.feature)}
            width={width}
            reduceMotion={reduceMotion}
            titleRef={(node) => {
              titleRefs.current[index] = node;
            }}
            onTry={() => {
              const data = handle.getPageData(item.feature);
              if (data) onTryFeature(item.feature, index, data.kind);
            }}
          />
        ))}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: layout.screenGutter,
          paddingTop: space.xs,
          paddingBottom: Math.max(insets.bottom, space.md),
        }}
      >
        {current > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => goTo(current - 1)}
            style={({ pressed }) => ({
              minWidth: MIN_TARGET,
              minHeight: MIN_TARGET,
              flexDirection: 'row',
              alignItems: 'center',
              opacity: pressed ? PRESSED_OPACITY : 1,
            })}
          >
            <ChevronLeft size={NAV_ICON} color={t.ink2} />
            <Text style={[type.subhead, { color: t.ink2 }]}>{tr('whatsNew.carousel.back')}</Text>
          </Pressable>
        ) : (
          <View style={{ minWidth: MIN_TARGET }} />
        )}

        {several ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {pages.map((item, index) => {
              const tried = triedFeatures.includes(item.feature);
              const isCurrent = index === current;
              return (
                <Pressable
                  key={item.feature}
                  testID={`whats-new-dot-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={tr('whatsNew.carousel.pageOf', {
                    current: index + 1,
                    total: pages.length,
                  })}
                  accessibilityState={{ selected: isCurrent, checked: tried }}
                  onPress={() => goTo(index)}
                  style={{
                    minWidth: MIN_TARGET / 2,
                    minHeight: MIN_TARGET,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: isCurrent ? DOT_CURRENT_WIDTH : DOT_SIZE,
                      height: DOT_SIZE,
                      borderRadius: radius.pill,
                      backgroundColor: isCurrent ? t.ink : tried ? t.success : t.surface3,
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={isLast ? close : () => goTo(current + 1)}
          style={({ pressed }) => ({
            minWidth: MIN_TARGET,
            minHeight: MIN_TARGET,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            opacity: pressed ? PRESSED_OPACITY : 1,
          })}
        >
          <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.ink }]}>
            {isLast ? tr('whatsNew.carousel.rideOn') : tr('whatsNew.carousel.next')}
          </Text>
          {isLast ? null : <ChevronRight size={NAV_ICON} color={t.ink} />}
        </Pressable>
      </View>
    </View>
  );
}
