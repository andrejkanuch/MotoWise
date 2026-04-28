import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { ArrowRight, Cloud, Coffee, Fuel, Home, Route, Sunrise, X } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditorialTheme } from '../../../theme/editorial';

// --- Types ---

interface TripStop {
  kind: 'start' | 'road' | 'fuel' | 'sleep' | 'end';
  name: string;
  time: string;
  meta: string;
}

interface TripDay {
  label: string;
  date: string;
  weather: { temp: string; condition: string; icon: 'sunrise' | 'cloud' };
  stops: TripStop[];
}

interface TripRider {
  id: string;
  name: string;
  color: string;
}

interface TripDetailSheetProps {
  title: string;
  dateRange: string;
  duration: string;
  totalKm: number;
  totalElev: number;
  fuelStops: number;
  ridingHours: number;
  days: TripDay[];
  riders: TripRider[];
  onClose: () => void;
  onConfirm?: () => void;
  onEdit?: () => void;
}

// --- Helpers ---

const STOP_ICONS: Record<TripStop['kind'], LucideIcon> = {
  start: Sunrise,
  end: Home,
  fuel: Fuel,
  sleep: Coffee,
  road: Route,
};

const STOP_COLORS: Record<TripStop['kind'], string> = {
  start: palette.editorialSuccess,
  end: palette.editorialDarkInk,
  fuel: palette.neutral400,
  sleep: palette.editorialLightWarm,
  road: palette.signature600,
};

const WEATHER_ICONS: Record<string, LucideIcon> = {
  sunrise: Sunrise,
  cloud: Cloud,
};

// --- Mock data ---

const MOCK_DAYS: TripDay[] = [
  {
    label: 'Saturday',
    date: 'Apr 27',
    weather: { temp: '14°C', condition: 'Dry', icon: 'sunrise' },
    stops: [
      {
        kind: 'start',
        name: 'Prague · Garage',
        time: '6:30',
        meta: 'Cold start · top-up tank',
      },
      {
        kind: 'road',
        name: 'Passo di Gavia',
        time: '13:10',
        meta: '76 km · ride · +1850m',
      },
      {
        kind: 'fuel',
        name: 'Bormio · Esso',
        time: '15:40',
        meta: 'Top up · ~280 km tank',
      },
      { kind: 'road', name: 'Grimsel Pass', time: '16:55', meta: '38 km · ride · +660m' },
      { kind: 'sleep', name: 'Hospiz Grimsel', time: '18:20', meta: 'Booked · 2 rooms' },
    ],
  },
  {
    label: 'Sunday',
    date: 'Apr 28',
    weather: { temp: '11°C', condition: 'Cloud · light wind', icon: 'cloud' },
    stops: [
      { kind: 'start', name: 'Hospiz Grimsel', time: '8:15', meta: 'Coffee · pack' },
      {
        kind: 'road',
        name: 'Furka · Andermatt loop',
        time: '11:50',
        meta: '92 km · ride · +1200m',
      },
      {
        kind: 'end',
        name: 'Prague · Garage',
        time: '19:40',
        meta: 'Home · ~580 km return',
      },
    ],
  },
];

const MOCK_RIDERS: TripRider[] = [
  { id: 'marek', name: 'Marek', color: palette.editorialInfo },
  { id: 'sara', name: 'Sara', color: palette.editorialSuccess },
  { id: 'kai', name: 'Kai', color: palette.signature500 },
];

// --- Sub-components ---

function TimelineStop({ stop, isLast }: { stop: TripStop; isLast: boolean }) {
  const { t } = useEditorialTheme();
  const Icon = STOP_ICONS[stop.kind];
  const dotColor = STOP_COLORS[stop.kind];

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 14,
        paddingBottom: isLast ? 4 : 18,
        position: 'relative',
      }}
    >
      {/* Time gutter */}
      <View style={{ width: 38, paddingTop: 1 }}>
        <Text
          style={{
            fontFamily: 'GeistMono',
            fontSize: 10.5,
            fontWeight: '600',
            color: t.ink2,
            letterSpacing: 0.2,
          }}
        >
          {stop.time}
        </Text>
      </View>

      {/* Dot + connecting line */}
      <View style={{ position: 'relative', width: 22 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: dotColor,
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 2px 6px rgba(26,21,16,0.18)`,
            borderWidth: 3,
            borderColor: t.bg,
          }}
        >
          <Icon size={11} color="#fff" />
        </View>
        {!isLast && (
          <View
            style={{
              position: 'absolute',
              left: 10,
              top: 24,
              bottom: -18,
              width: 2,
              backgroundColor: t.line,
            }}
          />
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            color: t.ink,
            letterSpacing: -0.1,
            lineHeight: 17,
            marginBottom: 2,
          }}
        >
          {stop.name}
        </Text>
        <Text style={{ fontSize: 11.5, color: t.ink3, lineHeight: 16 }}>{stop.meta}</Text>
      </View>
    </View>
  );
}

// --- Main component ---

export function TripDetailSheet({
  title = 'Gavia & Grimsel weekend',
  dateRange = 'Sat 27 → Sun 28 Apr',
  duration = '2 days · 1 night',
  totalKm = 627,
  totalElev = 3370,
  fuelStops = 2,
  ridingHours = 14,
  days = MOCK_DAYS,
  riders = MOCK_RIDERS,
  onClose,
  onConfirm,
  onEdit,
}: TripDetailSheetProps) {
  const { t } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  const handleConfirm = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm?.();
  }, [onConfirm]);

  const handleEdit = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit?.();
  }, [onEdit]);

  const stats = [
    { label: 'Distance', value: String(totalKm), unit: 'km' },
    { label: 'Climb', value: `+${totalElev}`, unit: 'm' },
    { label: 'Fuel', value: String(fuelStops), unit: 'stops' },
    { label: 'Riding', value: String(ridingHours), unit: 'h' },
  ];

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeIn.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        backgroundColor: 'rgba(26,21,16,0.4)',
      }}
    >
      <Pressable style={{ flex: 1 }} onPress={onClose} />

      <Animated.View
        entering={reducedMotion ? undefined : SlideInDown.duration(300).springify()}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '88%',
          backgroundColor: t.bg,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          overflow: 'hidden',
          boxShadow: '0 -20px 50px rgba(26,21,16,0.25)',
        }}
      >
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: t.ink4,
              opacity: 0.4,
            }}
          />
        </View>

        {/* Header */}
        <View
          style={{
            paddingHorizontal: 22,
            paddingTop: 8,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: t.line,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontFamily: 'GeistMono',
                  fontSize: 10,
                  letterSpacing: 1.8,
                  textTransform: 'uppercase',
                  color: t.warm,
                  fontWeight: '600',
                  marginBottom: 5,
                }}
              >
                Trip · Draft
              </Text>
              <Text
                style={{
                  fontFamily: 'InstrumentSerif',
                  fontSize: 26,
                  lineHeight: 28,
                  letterSpacing: -0.5,
                  color: t.ink,
                }}
              >
                {title}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <Text style={{ fontSize: 12, color: t.ink3 }}>{dateRange}</Text>
                <Text style={{ fontSize: 12, color: t.ink3, opacity: 0.4 }}>{'·'}</Text>
                <Text style={{ fontSize: 12, color: t.ink3 }}>{duration}</Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: t.surface2,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} color={t.ink2} />
            </Pressable>
          </View>

          {/* Stat strip */}
          <View
            style={{
              flexDirection: 'row',
              marginTop: 14,
              padding: 12,
              backgroundColor: t.surface,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: t.line,
            }}
          >
            {stats.map((s, i) => (
              <View
                key={s.label}
                style={{
                  flex: 1,
                  borderLeftWidth: i === 0 ? 0 : 1,
                  borderLeftColor: t.line,
                  paddingLeft: i === 0 ? 0 : 10,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'GeistMono',
                    fontSize: 9,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    color: t.ink3,
                    marginBottom: 3,
                  }}
                >
                  {s.label}
                </Text>
                <Text
                  style={{ fontSize: 16, fontWeight: '600', color: t.ink, letterSpacing: -0.2 }}
                >
                  {s.value}
                  <Text style={{ fontSize: 10, color: t.ink3, fontWeight: '500' }}>{s.unit}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Scrollable body */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          {days.map((day, di) => {
            const WeatherIcon = WEATHER_ICONS[day.weather.icon] ?? Sunrise;
            return (
              <View
                key={day.label}
                style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 4 }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 14,
                    gap: 10,
                  }}
                >
                  <View>
                    <Text
                      style={{
                        fontFamily: 'GeistMono',
                        fontSize: 9.5,
                        letterSpacing: 1.8,
                        textTransform: 'uppercase',
                        color: t.ink3,
                        marginBottom: 4,
                      }}
                    >
                      Day {di + 1} · {day.date}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'InstrumentSerif',
                        fontSize: 19,
                        color: t.ink,
                        letterSpacing: -0.4,
                      }}
                    >
                      {day.label}
                    </Text>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      backgroundColor: t.surface,
                      borderWidth: 1,
                      borderColor: t.line,
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <WeatherIcon size={12} color={t.warm} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: t.ink2 }}>
                      {day.weather.temp}
                    </Text>
                    <Text style={{ fontSize: 11, color: t.ink3 }}>{day.weather.condition}</Text>
                  </View>
                </View>

                {/* Timeline */}
                <View style={{ paddingLeft: 4 }}>
                  {day.stops.map((stop, si) => (
                    <TimelineStop
                      key={stop.name}
                      stop={stop}
                      isLast={si === day.stops.length - 1}
                    />
                  ))}
                </View>
              </View>
            );
          })}

          {/* Riders */}
          <View style={{ paddingHorizontal: 22, paddingTop: 20, paddingBottom: 4 }}>
            <Text
              style={{
                fontFamily: 'GeistMono',
                fontSize: 10,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: t.ink2,
                fontWeight: '600',
                marginBottom: 10,
              }}
            >
              Riding with
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
              {riders.map((rider) => (
                <View
                  key={rider.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: t.surface,
                    borderWidth: 1,
                    borderColor: t.line,
                    borderRadius: 999,
                    paddingVertical: 5,
                    paddingLeft: 5,
                    paddingRight: 12,
                  }}
                >
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: rider.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                      {rider.name[0]}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '500', color: t.ink }}>
                    {rider.name}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Sticky bottom CTAs */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 22,
            paddingTop: 14,
            paddingBottom: Math.max(insets.bottom, 22),
            flexDirection: 'row',
            gap: 10,
          }}
        >
          {/* Gradient scrim — use opaque fallback since LinearGradient isn't imported */}
          <View
            style={{
              position: 'absolute',
              top: -20,
              left: 0,
              right: 0,
              height: 20,
              backgroundColor: 'transparent',
            }}
          />

          <Pressable
            onPress={handleEdit}
            style={{
              paddingHorizontal: 16,
              height: 50,
              borderRadius: 25,
              borderCurve: 'continuous',
              backgroundColor: t.surface,
              borderWidth: 1,
              borderColor: t.line,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Route size={14} color={t.ink2} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: t.ink }}>Edit</Text>
          </Pressable>

          <Pressable
            onPress={handleConfirm}
            style={{
              flex: 1,
              height: 50,
              borderRadius: 25,
              borderCurve: 'continuous',
              backgroundColor: palette.editorialSuccess,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 12px 24px rgba(78,186,111,0.4)',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', letterSpacing: -0.1 }}>
              Confirm & start nav
            </Text>
            <ArrowRight size={14} color="#fff" strokeWidth={2.4} />
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
