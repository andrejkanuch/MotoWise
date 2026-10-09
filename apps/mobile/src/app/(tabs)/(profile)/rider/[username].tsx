import { GetRiderProfileDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Bike } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { FOLLOW_LIST_TAB, type FollowListTab } from '../../../../components/profile/constants';
import { FollowButton } from '../../../../components/profile/follow-button';
import { ProfileHeader } from '../../../../components/profile/profile-header';
import { ProfileStats } from '../../../../components/profile/profile-stats';
import { ESectionLabel, ESettingsGroup, ESettingsRow } from '../../../../components/ui/editorial';
import { QueryBoundary } from '../../../../components/ui/query-boundary';
import { PROFILE_ROUTE } from '../../../../config/routes';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { queryKeys } from '../../../../lib/query-keys';
import { meOptions } from '../../../../lib/query-options';
import { useEditorialTheme } from '../../../../theme/editorial';
import { GUTTER, radius, space, type } from '../../../../theme/type';

export default function RiderProfileScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const { username } = useLocalSearchParams<{ username: string }>();

  // Current user to detect own profile
  const meQuery = useQuery(meOptions());
  const currentUser = meQuery.data?.me;

  const profileQuery = useQuery({
    queryKey: queryKeys.profiles.byUsername(username ?? ''),
    queryFn: () => gqlFetcher(GetRiderProfileDocument, { username: username ?? '' }),
    enabled: !!username,
  });

  const profile = profileQuery.data?.getRiderProfile;
  const isOwnProfile = currentUser && profile ? currentUser.id === profile.id : false;

  const navigateToFollowers = (tab: FollowListTab) => {
    if (!profile) return;
    router.push({
      pathname: PROFILE_ROUTE.FOLLOWERS,
      params: { userId: profile.id, username: profile.publicUsername, tab },
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: username ? `@${username}` : t('community.riderProfile') }} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <QueryBoundary
          isLoading={profileQuery.isLoading}
          isError={profileQuery.isError}
          onRetry={() => profileQuery.refetch()}
          isEmpty={!profile}
          emptyState={
            <View
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}
            >
              <Text style={[type.body, { color: theme.ink3, textAlign: 'center' }]}>
                {t('community.profileNotFound')}
              </Text>
            </View>
          }
        >
          {profile && (
            <ScrollView
              contentInsetAdjustmentBehavior="automatic"
              style={{ flex: 1, backgroundColor: theme.bg }}
              contentContainerStyle={{
                paddingHorizontal: GUTTER,
                paddingTop: space.lg,
                paddingBottom: space.xxxl,
                gap: space.xl,
              }}
            >
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

              <ProfileStats
                followerCount={profile.followerCount}
                followingCount={profile.followingCount}
                totalRides={profile.rideStats.totalRides}
                totalDistance={profile.rideStats.totalDistance}
                onFollowersTap={() => navigateToFollowers(FOLLOW_LIST_TAB.FOLLOWERS)}
                onFollowingTap={() => navigateToFollowers(FOLLOW_LIST_TAB.FOLLOWING)}
              />

              {profile.bikes.length > 0 && (
                <Animated.View entering={FadeInUp.delay(100).duration(280)}>
                  <ESectionLabel label={t('community.bikes')} />
                  <ESettingsGroup>
                    {profile.bikes.map((bike) => (
                      <ESettingsRow
                        key={`${bike.make}-${bike.model}-${bike.year}`}
                        icon={Bike}
                        title={`${bike.year} ${bike.make} ${bike.model}`}
                        subtitle={bike.nickname ?? undefined}
                      />
                    ))}
                  </ESettingsGroup>
                </Animated.View>
              )}

              <Animated.View entering={FadeInUp.delay(150).duration(280)}>
                <ESectionLabel label={t('community.recentRides')} />
                <View
                  style={{
                    backgroundColor: theme.surface,
                    borderRadius: radius.card,
                    borderCurve: 'continuous',
                    padding: space.lg,
                    alignItems: 'center',
                  }}
                >
                  <Text style={[type.subhead, { color: theme.ink3 }]}>
                    {t('community.noPublicRides')}
                  </Text>
                </View>
              </Animated.View>
            </ScrollView>
          )}
        </QueryBoundary>
      </View>
    </>
  );
}
