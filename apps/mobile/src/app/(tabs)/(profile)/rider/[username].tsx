import { palette } from '@motovault/design-system';
import { GetRiderProfileDocument, MeDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Bike } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { FollowButton } from '../../../../components/profile/follow-button';
import { ProfileHeader } from '../../../../components/profile/profile-header';
import { ProfileStats } from '../../../../components/profile/profile-stats';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { queryKeys } from '../../../../lib/query-keys';

export default function RiderProfileScreen() {
  const { t } = useTranslation();
  const { username } = useLocalSearchParams<{ username: string }>();
  const isDark = useColorScheme() === 'dark';

  const bgColor = isDark ? palette.neutral950 : palette.white;
  const textColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const cardBg = isDark ? palette.surfaceElevated : palette.neutral50;
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : palette.neutral200;

  // Current user to detect own profile
  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });
  const currentUser = meQuery.data?.me;

  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUsername(username ?? ''),
    queryFn: () => gqlFetcher(GetRiderProfileDocument, { username: username ?? '' }),
    enabled: !!username,
  });

  const profile = profileQuery.data?.getRiderProfile;
  const isOwnProfile = currentUser && profile ? currentUser.id === profile.id : false;

  const navigateToFollowers = (tab: 'followers' | 'following') => {
    if (!profile) return;
    router.push({
      pathname: '/(tabs)/(profile)/rider/followers',
      params: { userId: profile.id, username: profile.publicUsername, tab },
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: username ? `@${username}` : t('community.riderProfile'),
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <ArrowLeft size={22} color={textColor} strokeWidth={2} />
            </Pressable>
          ),
          headerStyle: { backgroundColor: bgColor },
          headerTitleStyle: { color: textColor },
          headerShadowVisible: false,
        }}
      />
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        {profileQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={palette.primary500} />
          </View>
        ) : !profile ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ fontSize: 16, color: subtitleColor, textAlign: 'center' }}>
              {t('community.profileNotFound')}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 40 }}>
            {/* Header */}
            <ProfileHeader
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
              publicUsername={profile.publicUsername}
              city={profile.city}
              bio={profile.bio}
              isOwnProfile={isOwnProfile}
            />

            {/* Follow button (not on own profile) */}
            {!isOwnProfile && (
              <View style={{ alignItems: 'center' }}>
                <FollowButton
                  targetUserId={profile.id}
                  targetUsername={profile.publicUsername}
                  isFollowing={profile.isFollowing ?? false}
                />
              </View>
            )}

            {/* Stats */}
            <ProfileStats
              followerCount={profile.followerCount}
              followingCount={profile.followingCount}
              totalRides={profile.rideStats.totalRides}
              totalDistance={profile.rideStats.totalDistance}
              onFollowersTap={() => navigateToFollowers('followers')}
              onFollowingTap={() => navigateToFollowers('following')}
            />

            {/* Bikes */}
            {profile.bikes.length > 0 && (
              <Animated.View entering={FadeInUp.delay(100).duration(280)}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: subtitleColor,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    marginBottom: 8,
                    marginLeft: 4,
                  }}
                >
                  {t('community.bikes')}
                </Text>
                <View
                  style={{
                    backgroundColor: cardBg,
                    borderRadius: 14,
                    borderCurve: 'continuous',
                    overflow: 'hidden',
                    borderWidth: 1,
                    borderColor: cardBorder,
                  }}
                >
                  {profile.bikes.map((bike, index) => (
                    <View
                      key={`${bike.make}-${bike.model}-${bike.year}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 14,
                        gap: 12,
                        borderBottomWidth: index < profile.bikes.length - 1 ? 0.5 : 0,
                        borderBottomColor: cardBorder,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          borderCurve: 'continuous',
                          backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Bike size={18} color={palette.signature500} strokeWidth={1.8} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: textColor }}>
                          {bike.year} {bike.make} {bike.model}
                        </Text>
                        {bike.nickname && (
                          <Text style={{ fontSize: 13, color: subtitleColor, marginTop: 1 }}>
                            {bike.nickname}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>
            )}

            {/* Recent public rides placeholder */}
            <Animated.View entering={FadeInUp.delay(150).duration(280)}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: subtitleColor,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  marginBottom: 8,
                  marginLeft: 4,
                }}
              >
                {t('community.recentRides')}
              </Text>
              <View
                style={{
                  backgroundColor: cardBg,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  padding: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: cardBorder,
                }}
              >
                <Text style={{ fontSize: 14, color: subtitleColor }}>
                  {t('community.noPublicRides')}
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        )}
      </View>
    </>
  );
}
