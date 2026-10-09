import {
  GetFollowersDocument,
  type GetFollowersQuery,
  GetFollowingDocument,
} from '@motovault/graphql';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { FOLLOW_LIST_TAB, type FollowListTab } from '../../../../components/profile/constants';
import { RiderAvatar } from '../../../../components/profile/profile-header';
import { ThemedSegmentedControl } from '../../../../components/ui/themed-segmented-control';
import { PROFILE_ROUTE } from '../../../../config/routes';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { queryKeys } from '../../../../lib/query-keys';
import { meOptions } from '../../../../lib/query-options';
import { tint, useEditorialTheme } from '../../../../theme/editorial';
import { GUTTER, space, type } from '../../../../theme/type';
import { triggerImpact, triggerSelection } from '../../../../utils/haptics';

type FollowEdge = GetFollowersQuery['getFollowers']['edges'][number];

const PAGE_SIZE = 20;

export default function FollowersScreen() {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const params = useLocalSearchParams<{
    userId?: string;
    username?: string;
    tab?: FollowListTab;
  }>();
  // Own-profile entries may arrive without a userId — fall back to the
  // signed-in rider so the list still loads.
  const meQuery = useQuery({ ...meOptions(), enabled: !params.userId });
  const userId = params.userId || meQuery.data?.me?.id;
  const [activeTab, setActiveTab] = useState<FollowListTab>(
    params.tab === FOLLOW_LIST_TAB.FOLLOWING
      ? FOLLOW_LIST_TAB.FOLLOWING
      : FOLLOW_LIST_TAB.FOLLOWERS,
  );
  const isFollowersTab = activeTab === FOLLOW_LIST_TAB.FOLLOWERS;

  // Followers query
  const followersQuery = useInfiniteQuery({
    queryKey: queryKeys.followers.list(userId ?? ''),
    queryFn: ({ pageParam }) =>
      gqlFetcher(GetFollowersDocument, {
        userId: userId ?? '',
        first: PAGE_SIZE,
        after: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      const pi = lastPage?.getFollowers?.pageInfo;
      return pi?.hasNextPage ? (pi.endCursor ?? null) : null;
    },
    enabled: !!userId && isFollowersTab,
  });

  // Following query
  const followingQuery = useInfiniteQuery({
    queryKey: queryKeys.following.list(userId ?? ''),
    queryFn: ({ pageParam }) =>
      gqlFetcher(GetFollowingDocument, {
        userId: userId ?? '',
        first: PAGE_SIZE,
        after: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => {
      const pi = lastPage?.getFollowing?.pageInfo;
      return pi?.hasNextPage ? (pi.endCursor ?? null) : null;
    },
    enabled: !!userId && !isFollowersTab,
  });

  const activeQuery = isFollowersTab ? followersQuery : followingQuery;

  const edges: FollowEdge[] = isFollowersTab
    ? (followersQuery.data?.pages?.flatMap((p) => p?.getFollowers?.edges ?? []) ?? [])
    : (followingQuery.data?.pages?.flatMap((p) => p?.getFollowing?.edges ?? []) ?? []);

  const navigateToRider = (riderUsername: string | null | undefined) => {
    if (!riderUsername) return;
    triggerImpact();
    router.push({ pathname: PROFILE_ROUTE.RIDER, params: { username: riderUsername } });
  };

  const renderItem = ({ item, index }: { item: FollowEdge; index: number }) => {
    const node = item.node;
    const name = node.displayName || node.publicUsername || t('community.unknownRider');
    const uname = node.publicUsername;

    return (
      <Animated.View entering={FadeInUp.delay(Math.min(index, 10) * 40).duration(240)}>
        <Pressable
          onPress={() => navigateToRider(uname)}
          disabled={!uname}
          android_ripple={{ color: tint(theme.ink, 0.08) }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 60,
            paddingHorizontal: GUTTER,
            gap: space.sm,
            backgroundColor:
              pressed && process.env.EXPO_OS === 'ios' ? tint(theme.ink, 0.06) : 'transparent',
          })}
          accessibilityRole="button"
          accessibilityLabel={name}
        >
          <RiderAvatar url={node.avatarUrl} name={name} size={44} />
          <View
            style={{
              flex: 1,
              alignSelf: 'stretch',
              justifyContent: 'center',
              paddingVertical: space.sm,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.line,
            }}
          >
            <Text style={[type.bodyStrong, { color: theme.ink }]} numberOfLines={1}>
              {name}
            </Text>
            {uname ? (
              <Text style={[type.subhead, { color: theme.ink3 }]} numberOfLines={1}>
                @{uname}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const tabs = [FOLLOW_LIST_TAB.FOLLOWERS, FOLLOW_LIST_TAB.FOLLOWING] as const;
  const tabLabel = (tabKey: FollowListTab) =>
    tabKey === FOLLOW_LIST_TAB.FOLLOWERS ? t('community.followers') : t('community.following');

  return (
    <>
      <Stack.Screen options={{ title: tabLabel(activeTab) }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: space.xxxl }}
        data={activeQuery.isLoading ? [] : edges}
        keyExtractor={(item) => item.cursor}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: GUTTER, paddingVertical: space.sm }}>
            {params.username ? (
              <Text style={[type.subhead, { color: theme.ink3, marginBottom: space.xs }]}>
                @{params.username}
              </Text>
            ) : null}
            <ThemedSegmentedControl
              values={tabs.map(tabLabel)}
              selectedIndex={tabs.indexOf(activeTab)}
              onChange={(index) => {
                const next = tabs[index];
                if (!next) return;
                triggerSelection();
                setActiveTab(next);
              }}
            />
          </View>
        }
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xs,
              paddingTop: space.xxxl,
            }}
          >
            {activeQuery.isLoading || (!userId && meQuery.isLoading) ? (
              <ActivityIndicator size="large" color={theme.ink3} />
            ) : (
              <>
                <Users size={32} color={theme.ink3} strokeWidth={1.5} />
                <Text style={[type.body, { color: theme.ink3 }]}>
                  {isFollowersTab ? t('community.noFollowers') : t('community.noFollowing')}
                </Text>
              </>
            )}
          </View>
        }
        onEndReached={() => {
          if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
            activeQuery.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          activeQuery.isFetchingNextPage ? (
            <View style={{ padding: space.lg, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={theme.ink3} />
            </View>
          ) : null
        }
      />
    </>
  );
}
