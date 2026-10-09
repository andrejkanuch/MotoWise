import type { MeQuery } from '@motovault/graphql';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { PostHogMaskView } from 'posthog-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { PROFILE_ROUTE } from '../../config/routes';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';
import { FOLLOW_LIST_TAB, type FollowListTab } from './constants';
import { RiderAvatar } from './profile-header';

type User = MeQuery['me'];

const AVATAR_SIZE = 64;

function ProChip() {
  const { t: i18n } = useTranslation();
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        paddingHorizontal: space.xs,
        paddingVertical: 2,
        borderRadius: radius.chip - 4,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: t.line,
        backgroundColor: t.surface2,
      }}
    >
      <Text style={[type.label, { color: t.ink2 }]}>{i18n('proGate.proBadge')}</Text>
    </View>
  );
}

function FollowFigure({
  count,
  label,
  onPress,
  testID,
}: {
  count: number;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useEditorialTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${count} ${label}`}
      android_ripple={{ color: tint(t.ink, 0.08) }}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: space.xxs + 2,
        minHeight: 44,
        paddingVertical: space.xs,
        opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.6 : 1,
      })}
    >
      <Text style={[type.figureSmall, { color: t.ink }]}>{count}</Text>
      <Text style={[type.subhead, { color: t.ink3 }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Profile tab identity: avatar, name (condensed large title), @username and a
 * PRO chip. The whole block opens Edit profile. Public riders also get their
 * follower / following figures, which open their own lists.
 */
export function IdentityHeader({ user, isPro }: { user: User | undefined; isPro: boolean }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  const name = user?.displayName || user?.fullName || t('profile.rider');

  const openFollowList = (tab: FollowListTab) => {
    if (!user) return;
    router.push({
      pathname: PROFILE_ROUTE.FOLLOWERS,
      params: { userId: user.id, username: user.publicUsername ?? '', tab },
    });
  };

  return (
    <View style={{ gap: space.xs }}>
      <Pressable
        testID="profile-identity"
        onPress={() => {
          triggerImpact();
          router.push(PROFILE_ROUTE.EDIT_PROFILE);
        }}
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityHint={t('profile.editProfileHint')}
        android_ripple={{ color: tint(theme.ink, 0.08) }}
        style={({ pressed }) => ({
          borderRadius: radius.card,
          borderCurve: 'continuous',
          opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.7 : 1,
        })}
      >
        {/* Mask the rider's identity (name, @username, initials) from session
            replay — read-only `<Text>` is not covered by `maskAllTextInputs`.
            (todo 186) */}
        <PostHogMaskView
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 }}
        >
          <RiderAvatar url={user?.avatarUrl} name={name} size={AVATAR_SIZE} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[type.largeTitle, { color: theme.ink }]}>
              {name}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.xs,
                marginTop: 2,
              }}
            >
              {user?.publicUsername ? (
                <Text
                  numberOfLines={1}
                  style={[type.subhead, { color: theme.ink3, flexShrink: 1 }]}
                >
                  @{user.publicUsername}
                </Text>
              ) : null}
              {isPro ? <ProChip /> : null}
            </View>
          </View>
          <ChevronRight size={18} color={theme.ink4} strokeWidth={2} />
        </PostHogMaskView>
      </Pressable>

      {user?.isPublic ? (
        <View style={{ flexDirection: 'row', gap: space.xl }}>
          <FollowFigure
            testID="profile-followers"
            count={user.followerCount ?? 0}
            label={t('community.followers')}
            onPress={() => openFollowList(FOLLOW_LIST_TAB.FOLLOWERS)}
          />
          <FollowFigure
            testID="profile-following"
            count={user.followingCount ?? 0}
            label={t('community.following')}
            onPress={() => openFollowList(FOLLOW_LIST_TAB.FOLLOWING)}
          />
        </View>
      ) : null}
    </View>
  );
}
