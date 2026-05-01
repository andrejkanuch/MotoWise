import { palette } from '@motovault/design-system';
import { JoinTripDocument, type TripByShareTokenQuery } from '@motovault/graphql';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Eye, MapPin, UserPlus, Users } from 'lucide-react-native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getWaypointIcon } from '../../../components/trip/waypoint-type-picker';
import {
  type TrampolineState,
  useTripShareTokenResolver,
} from '../../../hooks/use-trip-share-token-resolver';
import { gqlFetcher } from '../../../lib/graphql-client';
import { userFriendlyError } from '../../../lib/graphql-errors';

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  };
  return `${s.toLocaleDateString('en-US', opts)} \u2013 ${e.toLocaleDateString('en-US', opts)}`;
}

export default function SharedTripTrampolineScreen() {
  const isDark = useColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();

  const bg = isDark ? palette.neutral950 : palette.white;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const bodyColor = isDark ? palette.neutral300 : palette.neutral600;

  const state = useTripShareTokenResolver(token);

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 12,
          zIndex: 10,
        }}
      >
        <Pressable
          onPress={handleClose}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: isDark ? palette.neutral900 : palette.neutral100,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={titleColor} />
        </Pressable>
      </View>

      {renderContent(state, {
        isDark,
        titleColor,
        bodyColor,
        bg,
        insetTop: insets.top,
        router,
      })}
    </View>
  );
}

type RenderCtx = {
  isDark: boolean;
  titleColor: string;
  bodyColor: string;
  bg: string;
  insetTop: number;
  router: ReturnType<typeof useRouter>;
};

function renderContent(state: TrampolineState, ctx: RenderCtx) {
  if (state.status === 'validating' || state.status === 'fetching') {
    return <LoadingView />;
  }
  if (state.status === 'failed') {
    return <ErrorView ctx={ctx} />;
  }
  return <SharedTripReadOnlyView trip={state.data} ctx={ctx} />;
}

function LoadingView() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={palette.accent500} />
    </View>
  );
}

function ErrorView({ ctx }: { ctx: RenderCtx }) {
  const openApp = () => {
    Linking.openURL('https://motovault.app');
  };
  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: '800',
          color: ctx.titleColor,
          textAlign: 'center',
          marginBottom: 10,
          letterSpacing: -0.4,
        }}
      >
        This trip isn't available
      </Text>
      <Text
        style={{
          fontSize: 15,
          color: ctx.bodyColor,
          textAlign: 'center',
          lineHeight: 22,
          marginBottom: 28,
        }}
      >
        The link may have been revoked or the trip no longer exists. Ask the organiser for a fresh
        link.
      </Text>
      <Pressable
        onPress={openApp}
        style={{
          backgroundColor: palette.accent500,
          paddingVertical: 14,
          paddingHorizontal: 28,
          borderRadius: 14,
          borderCurve: 'continuous',
        }}
      >
        <Text
          style={{
            color: palette.white,
            fontSize: 16,
            fontWeight: '700',
            letterSpacing: 0.2,
          }}
        >
          Open MotoVault
        </Text>
      </Pressable>
    </Animated.View>
  );
}

type SharedTripData = NonNullable<TripByShareTokenQuery['tripByShareToken']>;

function SharedTripReadOnlyView({ trip, ctx }: { trip: SharedTripData; ctx: RenderCtx }) {
  const sectionLabelColor = ctx.isDark ? palette.neutral500 : palette.neutral400;
  const dividerColor = ctx.isDark ? palette.neutral800 : palette.neutral200;

  const joinMutation = useMutation({
    mutationFn: () => gqlFetcher(JoinTripDocument, { input: { tripId: trip.id, status: 'going' } }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      ctx.router.replace({
        pathname: '/(modals)/trip-detail',
        params: { tripId: trip.id },
      });
    },
    onError: (err: Error) => {
      Alert.alert('Could not join', userFriendlyError(err));
    },
  });

  const waypoints = [...trip.waypoints].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: ctx.insetTop + 64,
        paddingHorizontal: 20,
        paddingBottom: 40,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Shared badge */}
      <Animated.View
        entering={FadeInUp.duration(240)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          backgroundColor: ctx.isDark ? palette.accentTint : palette.accentBgLight,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          borderCurve: 'continuous',
          marginBottom: 14,
          gap: 6,
        }}
      >
        <Eye size={12} color={palette.accent500} />
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            color: palette.accent500,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
          }}
        >
          Shared with you
        </Text>
      </Animated.View>

      {/* Title */}
      <Animated.Text
        entering={FadeInUp.delay(40).duration(260)}
        style={{
          fontSize: 28,
          fontWeight: '800',
          color: ctx.titleColor,
          letterSpacing: -0.5,
          marginBottom: 10,
        }}
      >
        {trip.title}
      </Animated.Text>

      {/* Dates */}
      <Animated.Text
        entering={FadeInUp.delay(80).duration(260)}
        style={{
          fontSize: 14,
          color: ctx.bodyColor,
          marginBottom: 6,
        }}
      >
        {formatDateRange(trip.startDate, trip.endDate)}
      </Animated.Text>

      {/* Meta row */}
      <Animated.View
        entering={FadeInUp.delay(120).duration(260)}
        style={{
          flexDirection: 'row',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Users size={13} color={ctx.bodyColor} />
          <Text style={{ fontSize: 13, color: ctx.bodyColor }}>
            {trip.participantCount}/{trip.maxRiders}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MapPin size={13} color={ctx.bodyColor} />
          <Text style={{ fontSize: 13, color: ctx.bodyColor }}>{waypoints.length} stops</Text>
        </View>
      </Animated.View>

      {trip.description && (
        <Animated.Text
          entering={FadeInUp.delay(160).duration(260)}
          style={{
            fontSize: 15,
            lineHeight: 22,
            color: ctx.bodyColor,
            marginBottom: 24,
          }}
        >
          {trip.description}
        </Animated.Text>
      )}

      {/* Waypoints */}
      {waypoints.length > 0 && (
        <Animated.View entering={FadeInUp.delay(200).duration(260)}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: sectionLabelColor,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Route
          </Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: dividerColor,
              borderRadius: 16,
              borderCurve: 'continuous',
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            {waypoints.map((wp, idx) => {
              const wt = getWaypointIcon(wp.type);
              const Icon = wt.Icon;
              return (
                <View
                  key={wp.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    padding: 14,
                    gap: 12,
                    borderTopWidth: idx === 0 ? 0 : 1,
                    borderTopColor: dividerColor,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      borderCurve: 'continuous',
                      backgroundColor: wt.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={16} color={palette.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: ctx.titleColor,
                        marginBottom: 2,
                      }}
                    >
                      {wp.name}
                    </Text>
                    {wp.notes && (
                      <Text
                        style={{
                          fontSize: 13,
                          color: ctx.bodyColor,
                          lineHeight: 18,
                        }}
                      >
                        {wp.notes}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>
      )}

      {/* Participants */}
      {trip.participants.length > 0 && (
        <Animated.View entering={FadeInUp.delay(240).duration(260)}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: sectionLabelColor,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Riders
          </Text>
          <View style={{ gap: 10, marginBottom: 24 }}>
            {trip.participants.map((p) => (
              <View
                key={p.anonId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: dividerColor,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderCurve: 'continuous',
                    backgroundColor: ctx.isDark ? palette.neutral800 : palette.neutral200,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: ctx.bodyColor,
                    }}
                  >
                    {p.displayName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: ctx.titleColor,
                    }}
                  >
                    {p.displayName}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: ctx.bodyColor,
                      textTransform: 'capitalize',
                    }}
                  >
                    {p.role} · {p.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Join trip CTA */}
      <Animated.View entering={FadeInUp.delay(280).duration(260)} style={{ gap: 10 }}>
        <Pressable
          onPress={() => joinMutation.mutate()}
          disabled={joinMutation.isPending}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: palette.accent500,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          {joinMutation.isPending ? (
            <ActivityIndicator size="small" color={palette.white} />
          ) : (
            <>
              <UserPlus size={18} color={palette.white} />
              <Text style={{ fontSize: 16, fontWeight: '700', color: palette.white }}>
                Join This Trip
              </Text>
            </>
          )}
        </Pressable>
      </Animated.View>
    </ScrollView>
  );
}
