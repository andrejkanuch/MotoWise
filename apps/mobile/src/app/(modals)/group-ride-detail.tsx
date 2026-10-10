import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  CancelGroupRideDocument,
  GroupRideDetailDocument,
  JoinGroupRideDocument,
  LeaveGroupRideDocument,
} from '@motovault/graphql';
import MapboxGL from '@rnmapbox/maps';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  LogOut,
  MapPin,
  Route,
  User,
  Users,
} from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommentList } from '../../components/comments/comment-list';
import { AnalyticsEvent, trackEvent } from '../../lib/analytics';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useAuthStore } from '../../stores/auth.store';
import { type EditorialTokens, tint, useEditorialTheme } from '../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../utils/haptics';
import { MAP_STYLES } from '../../utils/map-styles';

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} \u00b7 ${time}`;
}

/** Difficulty → status token (scheme-resolved at render). */
const DIFFICULTY_COLORS = {
  easy: 'success',
  moderate: 'dueInk',
  challenging: 'overdueInk',
} as const satisfies Record<string, keyof EditorialTokens>;

export default function GroupRideDetailScreen() {
  const { t } = useTranslation();
  const { t: theme, isDark } = useEditorialTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { groupRideId } = useLocalSearchParams<{ groupRideId: string }>();
  const sheetRef = useRef<BottomSheet>(null);
  const userId = useAuthStore((s) => s.session?.user?.id);
  const [actionLoading, setActionLoading] = useState(false);

  const bg = theme.bg;
  const titleColor = theme.ink;
  const subtitleColor = theme.ink3;
  const sheetBg = theme.surface;
  const sectionLabelColor = theme.ink3;
  const bodyColor = theme.ink2;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.groupRides.detail(groupRideId),
    queryFn: () => gqlFetcher(GroupRideDetailDocument, { groupRideId }),
    enabled: !!groupRideId,
  });

  const ride = data?.groupRideDetail;

  const isOrganiser = ride?.organiser.id === userId;
  const isParticipant = useMemo(
    () => ride?.participants?.some((p) => p.id === userId) ?? false,
    [ride?.participants, userId],
  );
  const isFull = ride?.status === 'full';
  const isPublished = ride?.status === 'published' || ride?.status === 'full';

  const difficultyKey = (
    ride?.difficulty ?? 'easy'
  ).toLowerCase() as keyof typeof DIFFICULTY_COLORS;
  const difficultyColor = theme[DIFFICULTY_COLORS[difficultyKey] ?? DIFFICULTY_COLORS.easy];
  const difficultyLabel = difficultyKey.charAt(0).toUpperCase() + difficultyKey.slice(1);

  const invalidateRide = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.groupRides.detail(groupRideId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.groupRides.all });
  }, [queryClient, groupRideId]);

  const joinMutation = useMutation({
    mutationFn: () => gqlFetcher(JoinGroupRideDocument, { groupRideId }),
    onMutate: () => setActionLoading(true),
    onSettled: () => setActionLoading(false),
    onSuccess: () => {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      trackEvent(AnalyticsEvent.GROUP_RIDE_JOINED, { group_ride_id: groupRideId });
      invalidateRide();
    },
  });

  const leaveMutation = useMutation({
    mutationFn: () => gqlFetcher(LeaveGroupRideDocument, { groupRideId }),
    onMutate: () => setActionLoading(true),
    onSettled: () => setActionLoading(false),
    onSuccess: () => {
      triggerImpact(Haptics.ImpactFeedbackStyle.Medium);
      trackEvent(AnalyticsEvent.GROUP_RIDE_LEFT, { group_ride_id: groupRideId });
      invalidateRide();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => gqlFetcher(CancelGroupRideDocument, { groupRideId }),
    onMutate: () => setActionLoading(true),
    onSettled: () => setActionLoading(false),
    onSuccess: () => {
      triggerNotification(Haptics.NotificationFeedbackType.Warning);
      invalidateRide();
      router.back();
    },
  });

  const handleCancel = useCallback(() => {
    Alert.alert('Cancel Ride', 'Are you sure you want to cancel this group ride?', [
      { text: 'Keep', style: 'cancel' },
      { text: 'Cancel Ride', style: 'destructive', onPress: () => cancelMutation.mutate() },
    ]);
  }, [cancelMutation]);

  const handleLeave = useCallback(() => {
    Alert.alert('Leave Ride', 'Are you sure you want to leave this group ride?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => leaveMutation.mutate() },
    ]);
  }, [leaveMutation]);

  const handleProfilePress = useCallback(
    (username: string) => {
      router.push({ pathname: '/(tabs)/(profile)/rider/[username]', params: { username } });
    },
    [router],
  );

  if (isLoading || !ride) {
    return (
      <View
        style={{ flex: 1, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color={theme.ink3} />
      </View>
    );
  }

  const meetingCoord =
    ride.meetingPointLat != null && ride.meetingPointLng != null
      ? [ride.meetingPointLng, ride.meetingPointLat]
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Map */}
      <MapboxGL.MapView
        style={{ flex: 1 }}
        styleURL={MAP_STYLES[isDark ? 'dark' : 'light']}
        compassEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        scaleBarEnabled={false}
      >
        {meetingCoord && (
          <MapboxGL.Camera
            defaultSettings={{ centerCoordinate: meetingCoord, zoomLevel: 13 }}
            animationMode="flyTo"
            animationDuration={500}
          />
        )}
        {meetingCoord && (
          <MapboxGL.MarkerView id="meeting-point" coordinate={meetingCoord}>
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: theme.warm,
                borderWidth: 3,
                borderColor: theme.surface,
              }}
            />
          </MapboxGL.MarkerView>
        )}
      </MapboxGL.MapView>

      {/* Floating back button */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 12,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderCurve: 'continuous',
            backgroundColor: tint(theme.surface, 0.85),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} color={theme.ink} />
        </Pressable>
      </View>

      {/* Bottom sheet */}
      <BottomSheet
        ref={sheetRef}
        snapPoints={['40%', '70%', '92%']}
        index={0}
        backgroundStyle={{ backgroundColor: sheetBg, borderRadius: 24, borderCurve: 'continuous' }}
        handleIndicatorStyle={{ backgroundColor: theme.ink4 }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          {/* Title */}
          <Text style={{ fontSize: 22, fontWeight: '800', color: titleColor, marginBottom: 4 }}>
            {ride.title}
          </Text>

          {/* Date & difficulty */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Calendar size={14} color={theme.ink3} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: subtitleColor }}>
                {formatDateTime(ride.dateTime)}
              </Text>
            </View>
            <View
              style={{
                backgroundColor: tint(difficultyColor, 0.14),
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                borderCurve: 'continuous',
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '700', color: difficultyColor }}>
                {difficultyLabel}
              </Text>
            </View>
          </View>

          {/* Description */}
          {ride.description && (
            <Animated.View entering={FadeIn.duration(300)} style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: sectionLabelColor,
                  marginBottom: 4,
                }}
              >
                {t('groupRide.descriptionLabel')}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 20, color: bodyColor }}>
                {ride.description}
              </Text>
            </Animated.View>
          )}

          {/* Meeting point */}
          {ride.meetingPointName && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <MapPin size={14} color={theme.ink3} />
              <Text style={{ fontSize: 13, color: subtitleColor }}>{ride.meetingPointName}</Text>
            </View>
          )}

          {/* Route info */}
          {ride.routeDescription && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Route size={14} color={theme.ink3} />
              <Text style={{ fontSize: 13, color: subtitleColor }}>{ride.routeDescription}</Text>
            </View>
          )}

          {/* Rider count */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: theme.surface2,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderCurve: 'continuous',
              marginBottom: 16,
            }}
          >
            <Users size={16} color={theme.ink3} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: titleColor }}>
              {t('groupRide.ridersCount', {
                count: ride.participantCount,
                max: ride.maxRiders,
              })}
            </Text>
            {isFull && (
              <View
                style={{
                  backgroundColor: tint(theme.danger, 0.12),
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderCurve: 'continuous',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: theme.overdueInk }}>
                  {t('groupRide.full')}
                </Text>
              </View>
            )}
          </View>

          {/* Organiser */}
          <Animated.View entering={FadeInUp.delay(50).duration(250)} style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '600',
                color: sectionLabelColor,
                marginBottom: 8,
              }}
            >
              {t('groupRide.organiser')}
            </Text>
            <Pressable
              onPress={() =>
                ride.organiser.publicUsername && handleProfilePress(ride.organiser.publicUsername)
              }
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              {ride.organiser.avatarUrl ? (
                <Image
                  source={{ uri: ride.organiser.avatarUrl }}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ) : (
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: theme.surface3,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <User size={16} color={subtitleColor} />
                </View>
              )}
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: titleColor }}>
                  {ride.organiser.displayName}
                </Text>
                {ride.organiser.publicUsername && (
                  <Text style={{ fontSize: 12, color: subtitleColor }}>
                    @{ride.organiser.publicUsername}
                  </Text>
                )}
              </View>
            </Pressable>
          </Animated.View>

          {/* Participants */}
          {ride.participants && ride.participants.length > 0 && (
            <Animated.View
              entering={FadeInUp.delay(100).duration(250)}
              style={{ marginBottom: 16 }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: sectionLabelColor,
                  marginBottom: 8,
                }}
              >
                {t('groupRide.participants')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {ride.participants.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => p.publicUsername && handleProfilePress(p.publicUsername)}
                    style={{ alignItems: 'center', gap: 4, width: 56 }}
                  >
                    {p.avatarUrl ? (
                      <Image
                        source={{ uri: p.avatarUrl }}
                        style={{ width: 36, height: 36, borderRadius: 18 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={200}
                        recyclingKey={p.id}
                      />
                    ) : (
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: theme.surface3,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <User size={16} color={subtitleColor} />
                      </View>
                    )}
                    <Text
                      style={{ fontSize: 10, color: subtitleColor, textAlign: 'center' }}
                      numberOfLines={1}
                    >
                      {p.displayName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Action buttons */}
          <Animated.View
            entering={FadeInUp.delay(150).duration(250)}
            style={{ gap: 10, marginBottom: 20 }}
          >
            {/* Join button */}
            {isPublished && !isFull && !isParticipant && !isOrganiser && (
              <Pressable
                onPress={() => joinMutation.mutate()}
                disabled={actionLoading}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: theme.warm,
                }}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color={theme.onWarm} />
                ) : (
                  <>
                    <Users size={16} color={theme.onWarm} />
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.onWarm }}>
                      {t('groupRide.joinRide')}
                    </Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Leave button */}
            {isParticipant && !isOrganiser && (
              <Pressable
                onPress={handleLeave}
                disabled={actionLoading}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: 'transparent',
                  borderWidth: 1,
                  borderColor: theme.danger,
                }}
              >
                <LogOut size={16} color={theme.overdueInk} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.overdueInk }}>
                  {t('groupRide.leaveRide')}
                </Text>
              </Pressable>
            )}

            {/* Cancel button (organiser only) */}
            {isOrganiser && ride.status !== 'cancelled' && (
              <Pressable
                onPress={handleCancel}
                disabled={actionLoading}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 14,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: tint(theme.danger, 0.12),
                }}
              >
                <AlertTriangle size={16} color={theme.overdueInk} />
                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.overdueInk }}>
                  {t('groupRide.cancelRide')}
                </Text>
              </Pressable>
            )}
          </Animated.View>

          {/* Comments */}
          <CommentList groupRideId={groupRideId} />
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
