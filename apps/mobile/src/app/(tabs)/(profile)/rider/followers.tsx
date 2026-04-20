import { palette } from '@motovault/design-system';
import {
  GetFollowersDocument,
  type GetFollowersQuery,
  GetFollowingDocument,
} from '@motovault/graphql';
import { useInfiniteQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Users } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../../../lib/graphql-client';
import { queryKeys } from '../../../../lib/query-keys';

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

type FollowEdge = GetFollowersQuery['getFollowers']['edges'][number];

const PAGE_SIZE = 20;

export default function FollowersScreen() {
  const { t } = useTranslation();
  const { userId, username, tab } = useLocalSearchParams<{
    userId: string;
    username: string;
    tab: 'followers' | 'following';
  }>();
  const isDark = useColorScheme() === 'dark';
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(tab ?? 'followers');

  const bgColor = isDark ? palette.neutral950 : palette.white;
  const textColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const avatarBg = isDark ? palette.neutral800 : palette.neutral200;

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
    enabled: !!userId && activeTab === 'followers',
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
    enabled: !!userId && activeTab === 'following',
  });

  const activeQuery = activeTab === 'followers' ? followersQuery : followingQuery;

  const edges: FollowEdge[] =
    activeTab === 'followers'
      ? (followersQuery.data?.pages?.flatMap((p) => p?.getFollowers?.edges ?? []) ?? [])
      : (followingQuery.data?.pages?.flatMap((p) => p?.getFollowing?.edges ?? []) ?? []);

  const navigateToRider = (riderUsername: string | null | undefined) => {
    if (!riderUsername) return;
    haptic();
    router.push(`/(tabs)/(profile)/rider/${riderUsername}`);
  };

  const renderItem = ({ item, index }: { item: FollowEdge; index: number }) => {
    const node = item.node;
    const name = node.displayName || node.publicUsername || t('community.unknownRider');
    const uname = node.publicUsername;
    const avatar = node.avatarUrl;

    const initials = name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    return (
      <Animated.View entering={FadeInUp.delay(index * 40).duration(240)}>
        <Pressable
          onPress={() => navigateToRider(uname)}
          disabled={!uname}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 12,
            gap: 12,
            backgroundColor: pressed
              ? isDark
                ? palette.surfacePressed
                : palette.neutral50
              : 'transparent',
          })}
          accessibilityRole="button"
          accessibilityLabel={name}
        >
          {/* Avatar */}
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              borderCurve: 'continuous',
              backgroundColor: avatarBg,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {avatar ? (
              <Image source={{ uri: avatar }} style={{ width: 44, height: 44 }} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: '700', color: subtitleColor }}>
                {initials}
              </Text>
            )}
          </View>

          {/* Info */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: textColor }} numberOfLines={1}>
              {name}
            </Text>
            {uname && (
              <Text style={{ fontSize: 13, color: subtitleColor }} numberOfLines={1}>
                @{uname}
              </Text>
            )}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: username ? `@${username}` : '',
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
        {/* Tab bar */}
        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: 20,
            gap: 0,
            borderBottomWidth: 0.5,
            borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          }}
        >
          {(['followers', 'following'] as const).map((tabKey) => {
            const isActive = activeTab === tabKey;
            return (
              <Pressable
                key={tabKey}
                onPress={() => {
                  haptic();
                  setActiveTab(tabKey);
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: 2,
                  borderBottomColor: isActive ? palette.primary500 : 'transparent',
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: isActive ? palette.primary500 : subtitleColor,
                  }}
                >
                  {t(`community.${tabKey}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* List */}
        {activeQuery.isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={palette.primary500} />
          </View>
        ) : edges.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Users size={32} color={subtitleColor} strokeWidth={1.5} />
            <Text style={{ fontSize: 15, color: subtitleColor }}>
              {activeTab === 'followers' ? t('community.noFollowers') : t('community.noFollowing')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={edges}
            keyExtractor={(item) => item.cursor}
            renderItem={renderItem}
            onEndReached={() => {
              if (activeQuery.hasNextPage && !activeQuery.isFetchingNextPage) {
                activeQuery.fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              activeQuery.isFetchingNextPage ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={palette.primary500} />
                </View>
              ) : null
            }
          />
        )}
      </View>
    </>
  );
}
