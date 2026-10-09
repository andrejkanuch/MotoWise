// CarPlay Companion — Hub (design spec §5 Screen 1 / imported design HubScreen).
// Start-mode picker + active bike + live status strip + more rows.
// Static/mock-wired for now — TODO(carplay) markers flag the real store hookups
// (start-mode pref via auth.store partialize; active bike via my-motorcycles;
// live strip via the carplay-coordinator snapshot).

import { mileageUnitLabel } from '@motovault/types';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CardGroup, Eyebrow, PulseDot, SectionLabel } from '../../../components/carplay/primitives';
import { useActiveBike, useCarPlayConnection } from '../../../features/carplay/use-carplay';
import { useMeasurementSystem } from '../../../hooks/use-measurement-system';
import { type StartMode, useCarPlayStore } from '../../../stores/carplay.store';
import { tint, useEditorialTheme } from '../../../theme/editorial';
import { radius, SYSTEM_WEIGHT, type } from '../../../theme/type';
import { triggerImpact } from '../../../utils/haptics';

export default function CarPlayHubScreen() {
  const { t } = useTranslation();
  const { t: c } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const mode = useCarPlayStore((s) => s.startMode);
  const setStartMode = useCarPlayStore((s) => s.setStartMode);
  const bike = useActiveBike();
  const system = useMeasurementSystem();
  const { connected } = useCarPlayConnection();

  const bikeName = bike
    ? (bike.nickname ?? `${bike.make} ${bike.model}`)
    : t('carplay.hub.noBike', { defaultValue: 'No bike selected' });
  const bikeStat =
    bike?.currentMileage != null
      ? `${bike.currentMileage.toLocaleString()} ${mileageUnitLabel(system).toUpperCase()}`
      : '—';

  const pick = (m: StartMode) => {
    triggerImpact();
    setStartMode(m);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('carplay.a11y.back', { defaultValue: 'Back' })}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            borderCurve: 'continuous',
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft size={18} color={c.ink2} strokeWidth={2} />
        </Pressable>
        <Text style={{ ...type.sheetTitle, color: c.ink }}>
          {t('carplay.hub.title', { defaultValue: 'CarPlay Companion' })}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 28 }}
      >
        <Text
          style={{
            ...type.subhead,
            color: c.ink2,
            paddingHorizontal: 4,
            paddingTop: 2,
          }}
        >
          {t('carplay.hub.intro', {
            defaultValue:
              'Log rides from your bike’s screen. Controls live on the head unit — the phone just confirms.',
          })}
        </Text>

        <SectionLabel>{t('carplay.hub.startMode', { defaultValue: 'Start mode' })}</SectionLabel>
        <View style={{ gap: 10 }}>
          <Animated.View entering={FadeInUp.delay(40).duration(300)}>
            <RadioCard
              selected={mode === 'automatic'}
              onPress={() => pick('automatic')}
              badge={t('carplay.hub.recommended', { defaultValue: 'Recommended' })}
              title={t('carplay.hub.modeAuto', { defaultValue: 'Automatic' })}
              consequence={t('carplay.hub.modeAutoDesc', {
                defaultValue:
                  'Rides start themselves on first GPS fix and pause at long stops. Nothing to tap.',
              })}
            >
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: c.surface2,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  borderWidth: 1,
                  borderColor: c.line,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Eyebrow style={{ marginBottom: 3, marginTop: 0 }}>
                    {t('carplay.hub.keepGuard', { defaultValue: 'Keep-guard' })}
                  </Eyebrow>
                  <Text style={{ ...type.figureSmall, color: c.ink }}>{'500 m · 2 min'}</Text>
                </View>
                <Text style={{ ...type.label, ...SYSTEM_WEIGHT.semibold, color: c.warm2 }}>
                  {t('carplay.hub.adjust', { defaultValue: 'Adjust' })}
                </Text>
              </View>
            </RadioCard>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(100).duration(300)}>
            <RadioCard
              selected={mode === 'manual'}
              onPress={() => pick('manual')}
              title={t('carplay.hub.modeManual', { defaultValue: 'Manual' })}
              consequence={t('carplay.hub.modeManualDesc', {
                defaultValue:
                  'Nothing logs until you press Start Ride on the head unit. Full control, zero surprises.',
              })}
            />
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(160).duration(300)}>
            <RadioCard
              selected={mode === 'phoneFirst'}
              onPress={() => pick('phoneFirst')}
              title={t('carplay.hub.modePhoneFirst', { defaultValue: 'Phone-first' })}
              consequence={t('carplay.hub.modePhoneFirstDesc', {
                defaultValue:
                  'Start on the phone, hand off to CarPlay when you connect. For pre-ride setup.',
              })}
            />
          </Animated.View>
        </View>

        <SectionLabel>{t('carplay.hub.activeBike', { defaultValue: 'Active bike' })}</SectionLabel>
        <View
          style={{
            backgroundColor: c.surface,
            borderRadius: 18,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: c.line,
            padding: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              borderCurve: 'continuous',
              padding: 2,
              backgroundColor: c.line2,
            }}
          >
            {/* TODO(carplay): bike primaryPhotoUrl */}
            <View
              style={{
                flex: 1,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: c.surface3,
                borderWidth: 2,
                borderColor: c.bg,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...type.bodyStrong, color: c.ink }}>{bikeName}</Text>
            <Text style={{ ...type.caption, color: c.ink3, marginTop: 2 }}>{bikeStat}</Text>
          </View>
          <ChevronRight size={18} color={c.ink4} strokeWidth={2} />
        </View>

        {/* live status strip — only when the head unit is connected */}
        {connected && (
          <View
            style={{
              marginTop: 12,
              backgroundColor: tint(c.success, 0.12),
              borderRadius: radius.control,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: tint(c.success, 0.3),
              paddingVertical: 12,
              paddingHorizontal: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 11,
            }}
          >
            <PulseDot color={c.success} />
            <Text style={{ ...type.label, ...SYSTEM_WEIGHT.semibold, color: c.ink }}>
              {`${bikeName.toUpperCase()} · ${t('carplay.hub.connected', { defaultValue: 'CONNECTED' })}`}
            </Text>
          </View>
        )}

        <SectionLabel>{t('carplay.hub.more', { defaultValue: 'More' })}</SectionLabel>
        <CardGroup>
          <NavRow
            label={t('carplay.hub.cues', { defaultValue: 'Confirmation cues' })}
            onPress={() => router.push('/(modals)/carplay/cues')}
            first
          />
          <NavRow
            label={t('carplay.hub.howItWorks', { defaultValue: 'How it works' })}
            onPress={() => router.push('/(modals)/carplay/onboarding')}
          />
        </CardGroup>
      </ScrollView>
    </View>
  );
}

function RadioCard({
  selected,
  badge,
  title,
  consequence,
  children,
  onPress,
}: {
  selected: boolean;
  badge?: string;
  title: string;
  consequence: string;
  children?: React.ReactNode;
  onPress: () => void;
}) {
  const { t: c } = useEditorialTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      style={{
        backgroundColor: c.surface,
        borderRadius: 18,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        borderColor: selected ? c.warm : c.line,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderCurve: 'continuous',
            marginTop: 1,
            borderWidth: 2,
            borderColor: selected ? c.warm : c.ink4,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <View
              style={{
                width: 11,
                height: 11,
                borderRadius: 6,
                borderCurve: 'continuous',
                backgroundColor: c.warm,
              }}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ ...type.bodyStrong, color: c.ink }}>{title}</Text>
            {badge && (
              <Text
                style={{
                  ...type.caption,
                  ...SYSTEM_WEIGHT.semibold,
                  color: c.ink2,
                  backgroundColor: c.surface3,
                  borderRadius: 6,
                  borderCurve: 'continuous',
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  overflow: 'hidden',
                }}
              >
                {badge}
              </Text>
            )}
          </View>
          <Text style={{ ...type.subhead, color: c.ink2 }}>{consequence}</Text>
          {children}
        </View>
      </View>
    </Pressable>
  );
}

function NavRow({
  label,
  onPress,
  first,
}: {
  label: string;
  onPress: () => void;
  first?: boolean;
}) {
  const { t: c } = useEditorialTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      android_ripple={{ color: c.line2 }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line2,
      }}
    >
      <Text style={{ ...type.body, flex: 1, color: c.ink }}>{label}</Text>
      <ChevronRight size={17} color={c.ink4} strokeWidth={2} />
    </Pressable>
  );
}
