// CarPlay Companion — Onboarding pager (design spec §5 Screen 3 / OnboardCard1+3).
// Editorial 3-card explainer: what it is · rides alongside nav · pick your start.
// Auto-shown on first connect and re-openable. TODO(carplay): first-connect flag (U11)
// and commit the chosen mode to the start-mode pref.

import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Eyebrow,
  INK_ON_COPPER,
  MONO,
  PulseDot,
  SERIF,
  SERIF_ITALIC,
} from '../../../components/carplay/primitives';
import { StateGlyph } from '../../../components/carplay/state-indicator';
import { useEditorialTheme } from '../../../theme/editorial';
import { triggerImpact } from '../../../utils/haptics';

export default function CarPlayOnboardingScreen() {
  const { t } = useTranslation();
  const { t: c } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) {
      setPage(p);
      triggerImpact();
    }
  };

  const finish = () => {
    triggerImpact();
    router.back(); // TODO(carplay): mark onboarding seen + commit selected mode
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ position: 'absolute', top: insets.top + 8, right: 18, zIndex: 2 }}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.ink3 }}>
            {t('carplay.onboarding.skip', { defaultValue: 'Skip' })}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        <CardShell width={width} insets={insets}>
          <Eyebrow>
            {t('carplay.onboarding.c1Eyebrow', { defaultValue: 'On the bike screen' })}
          </Eyebrow>
          <Display
            first={t('carplay.onboarding.c1A', { defaultValue: 'Your ride, on the ' })}
            em={t('carplay.onboarding.c1Em', { defaultValue: 'cluster' })}
            last="."
          />
          <Text style={{ fontSize: 15, color: c.ink2, lineHeight: 22, marginTop: 14 }}>
            {t('carplay.onboarding.c1Body', {
              defaultValue:
                'Distance, climb and moving time live on your motorcycle’s display — glance, never tap.',
            })}
          </Text>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <MiniTile />
          </View>
        </CardShell>

        <CardShell width={width} insets={insets}>
          <Eyebrow>
            {t('carplay.onboarding.c2Eyebrow', { defaultValue: 'Rides alongside your nav' })}
          </Eyebrow>
          <Display
            first={t('carplay.onboarding.c2A', { defaultValue: 'Keep your ' })}
            em={t('carplay.onboarding.c2Em', { defaultValue: 'directions' })}
            last="."
          />
          <Text style={{ fontSize: 15, color: c.ink2, lineHeight: 22, marginTop: 14 }}>
            {t('carplay.onboarding.c2Body', {
              defaultValue:
                'MotoVault never takes the map. Your nav app keeps showing turns — the toggle flips to MotoVault for a glance, then back.',
            })}
          </Text>
          <View style={{ flex: 1 }} />
        </CardShell>

        <CardShell width={width} insets={insets}>
          <Eyebrow>{t('carplay.onboarding.c3Eyebrow', { defaultValue: 'How it starts' })}</Eyebrow>
          <Display
            first={t('carplay.onboarding.c3A', { defaultValue: 'Pick your ' })}
            em={t('carplay.onboarding.c3Em', { defaultValue: 'start' })}
            last="."
          />
          <Text style={{ fontSize: 15, color: c.ink2, lineHeight: 22, marginTop: 14 }}>
            {t('carplay.onboarding.c3Body', {
              defaultValue:
                'Change it anytime in the companion. You can always tell what’s about to happen.',
            })}
          </Text>
          <View style={{ flex: 1, justifyContent: 'center', gap: 11 }}>
            <MiniMode
              title={t('carplay.hub.modeAuto', { defaultValue: 'Automatic' })}
              sub={t('carplay.onboarding.autoSub', { defaultValue: 'Logs itself' })}
              selected
            />
            <MiniMode
              title={t('carplay.hub.modeManual', { defaultValue: 'Manual' })}
              sub={t('carplay.onboarding.manualSub', { defaultValue: 'You press start' })}
            />
            <MiniMode
              title={t('carplay.hub.modePhoneFirst', { defaultValue: 'Phone-first' })}
              sub={t('carplay.onboarding.phoneSub', { defaultValue: 'Start here' })}
            />
          </View>
        </CardShell>
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + 20,
          paddingHorizontal: 26,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 7,
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: i === page ? 20 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === page ? c.warm : c.surface3,
              }}
            />
          ))}
        </View>
        <Pressable
          onPress={page < 2 ? () => triggerImpact() : finish}
          style={{
            height: 54,
            borderRadius: 16,
            backgroundColor: c.warm,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: INK_ON_COPPER }}>
            {page < 2
              ? t('carplay.onboarding.continue', { defaultValue: 'Continue' })
              : t('carplay.onboarding.start', { defaultValue: 'Start riding' })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function CardShell({
  width,
  insets,
  children,
}: {
  width: number;
  insets: { top: number };
  children: React.ReactNode;
}) {
  const { t: c } = useEditorialTheme();
  return (
    <View
      style={{
        width,
        paddingTop: insets.top + 56,
        paddingHorizontal: 26,
        paddingBottom: 150,
        flex: 1,
        backgroundColor: c.bg,
      }}
    >
      {children}
    </View>
  );
}

function Display({ first, em, last }: { first: string; em: string; last: string }) {
  const { t: c } = useEditorialTheme();
  return (
    <Text
      style={{
        marginTop: 12,
        fontFamily: SERIF,
        fontSize: 38,
        lineHeight: 41,
        letterSpacing: -0.5,
        color: c.ink,
      }}
    >
      {first}
      <Text style={{ fontFamily: SERIF_ITALIC, color: c.warm2 }}>{em}</Text>
      {last}
    </Text>
  );
}

function MiniMode({ title, sub, selected }: { title: string; sub: string; selected?: boolean }) {
  const { t: c } = useEditorialTheme();
  return (
    <View
      style={{
        backgroundColor: c.surface,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: selected ? c.warm : c.line,
        paddingVertical: 15,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          borderWidth: 2,
          borderColor: selected ? c.warm : c.ink4,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected && (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.warm }} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: c.ink }}>{title}</Text>
        <Text style={{ fontSize: 13, color: c.ink3, marginTop: 1 }}>{sub}</Text>
      </View>
    </View>
  );
}

// Faithful scaled mock of the CarPlay tile (the trust-builder). Represents the
// system-rendered surface, so it uses neutral dark tokens, not MotoVault chrome —
// except the copper pulse-ring, which signals "MotoVault is recording".
function MiniTile() {
  const { t: c } = useEditorialTheme();
  return (
    <View style={{ width: 300, backgroundColor: c.bg2, borderRadius: 14, padding: 8 }}>
      <View style={{ backgroundColor: c.surface, borderRadius: 7, overflow: 'hidden' }}>
        <View
          style={{
            paddingTop: 10,
            paddingHorizontal: 14,
            paddingBottom: 4,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontFamily: MONO, color: c.ink2, fontSize: 11, fontWeight: '600' }}>
            {'14:32'}
          </Text>
          <Text style={{ fontFamily: MONO, color: c.ink3, fontSize: 11, letterSpacing: 1 }}>
            {'MotoVault'}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 }}>
            <PulseDot color={c.warm} size={14} />
            <StateGlyph state="recording" size={20} color={c.success} />
            <Text style={{ color: c.ink, fontWeight: '700', fontSize: 17 }}>{'RECORDING'}</Text>
            <Text style={{ color: c.ink, fontWeight: '700', fontSize: 17 }}>{'· 42.3 km'}</Text>
          </View>
          {[
            ['Moving', '1:12:40'],
            ['Climb', '+640 m'],
          ].map(([l, v]) => (
            <View
              key={l}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 6,
                borderTopWidth: 1,
                borderTopColor: c.line2,
              }}
            >
              <Text style={{ color: c.ink2, fontSize: 13 }}>{l}</Text>
              <Text style={{ color: c.ink, fontWeight: '600', fontSize: 13, fontFamily: MONO }}>
                {v}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
