import { palette } from '@motovault/design-system';
import type { MeQuery, MyMotorcyclesQuery } from '@motovault/graphql';
import { FREE_TIER_LIMITS } from '@motovault/types';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  Bike,
  Bookmark,
  BookOpen,
  ChevronRight,
  Crown,
  Flame,
  Map as MapRoute,
  Navigation,
  Pencil,
  Plus,
  Settings,
} from 'lucide-react-native';
import { PostHogMaskView } from 'posthog-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { ProBadge } from '../../../../components/pro-badge';
import { ESettingsSectionLabel } from '../../../../components/ui/editorial';
import { tint, useEditorialTheme } from '../../../../theme/editorial';
import { triggerImpact } from '../../../../utils/haptics';

type User = MeQuery['me'];
type Motorcycle = MyMotorcyclesQuery['myMotorcycles'][number];
type EditorialTheme = ReturnType<typeof useEditorialTheme>['t'];

/** One row in the profile navigation list — icon bubble + title/subtitle +
 *  chevron. Extracted from five structurally identical cards. */
function ProfileNavCard({
  icon,
  iconBg,
  title,
  subtitle,
  onPress,
  delay,
  theme,
  isDark,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  delay: number;
  theme: EditorialTheme;
  isDark: boolean;
}) {
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(400)}>
      <Pressable
        onPress={() => {
          triggerImpact();
          onPress();
        }}
        style={{
          backgroundColor: theme.surface,
          borderRadius: 20,
          borderCurve: 'continuous',
          padding: 20,
          flexDirection: 'row',
          alignItems: 'center',
          boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            borderCurve: 'continuous',
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 14,
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.ink, fontSize: 17, fontWeight: '700' }}>{title}</Text>
          <Text style={{ color: theme.ink3, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
        </View>
        <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

export function AccountSection({
  user,
  motorcycles,
  isPro,
  isDark,
  onAddBike,
}: {
  user: User | undefined;
  motorcycles: Motorcycle[];
  isPro: boolean;
  isDark: boolean;
  onAddBike: () => void;
}) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  const initials =
    user?.fullName
      ?.split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?';

  return (
    <>
      {/* Editorial heading */}
      <View style={{ paddingHorizontal: 4, paddingTop: 8 }}>
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Regular',
            fontSize: 40,
            color: theme.ink,
            letterSpacing: -0.8,
            lineHeight: 40,
          }}
        >
          {t('profile.title')}
        </Text>
      </View>

      {/* User Card */}
      <Animated.View entering={FadeInUp.duration(400)}>
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 20,
            borderCurve: 'continuous',
            padding: 20,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          {/* Mask the rider's identity (name, @username, initials) from session
              replay — read-only `<Text>` is not covered by `maskAllTextInputs`.
              (todo 186) */}
          <PostHogMaskView style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                borderCurve: 'continuous',
                overflow: 'hidden',
              }}
            >
              <LinearGradient
                colors={[theme.warm, theme.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: '600', color: palette.white }}>
                  {initials}
                </Text>
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text
                  selectable
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: theme.ink,
                    letterSpacing: -0.1,
                  }}
                >
                  {user?.fullName ?? t('profile.rider')}
                </Text>
                {isPro && <ProBadge />}
              </View>

              {/* Public profile info */}
              {user?.publicUsername && (
                <Text
                  style={{
                    fontSize: 13,
                    color: theme.ink2,
                    marginTop: 2,
                  }}
                >
                  @{user.publicUsername}
                </Text>
              )}
            </View>
          </PostHogMaskView>

          {/* Action buttons row */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {/* Edit Public Profile */}
            <Pressable
              onPress={() => {
                triggerImpact();
                router.push('/(profile)/edit-profile');
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 20,
                borderCurve: 'continuous',
                borderWidth: 1.5,
                borderColor: theme.warm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Pencil size={14} color={theme.warm} strokeWidth={2} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.warm,
                }}
              >
                {t('community.editProfile')}
              </Text>
            </Pressable>

            {/* Settings */}
            <Pressable
              onPress={() => {
                triggerImpact();
                router.push('/(profile)/settings');
              }}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                borderRadius: 20,
                borderCurve: 'continuous',
                borderWidth: 1.5,
                borderColor: theme.ink3,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Settings size={14} color={theme.ink3} strokeWidth={2} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: theme.ink3,
                }}
              >
                {t('settings.title', { defaultValue: 'Settings' })}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Follower / Following stats (only if public profile) */}
      {user?.isPublic && (
        <Animated.View entering={FadeInUp.delay(60).duration(400)}>
          <View
            style={{
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <Pressable
              onPress={() => router.push('/(profile)/rider/followers')}
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                alignItems: 'center',
                boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: theme.ink,
                }}
              >
                {user.followerCount ?? 0}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.ink3,
                  marginTop: 2,
                }}
              >
                {t('community.followers')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(profile)/rider/followers')}
              style={{
                flex: 1,
                backgroundColor: theme.surface,
                borderRadius: 16,
                borderCurve: 'continuous',
                padding: 16,
                alignItems: 'center',
                boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
              }}
            >
              <Text
                style={{
                  fontSize: 22,
                  fontWeight: '700',
                  color: theme.ink,
                }}
              >
                {user.followingCount ?? 0}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.ink3,
                  marginTop: 2,
                }}
              >
                {t('community.following')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      )}

      {/* My Bikes */}
      <Animated.View entering={FadeInUp.delay(80).duration(400)}>
        <ESettingsSectionLabel label={t('profile.myBikes', { defaultValue: 'My Bikes' })} />
        <View
          style={{
            backgroundColor: theme.surface,
            borderRadius: 16,
            borderCurve: 'continuous',
            overflow: 'hidden',
            boxShadow: isDark ? 'none' : `0 1px 3px ${tint(theme.ink, 0.06)}`,
          }}
        >
          {motorcycles.length === 0 ? (
            <Pressable
              onPress={() => {
                triggerImpact();
                router.navigate('/(tabs)/(garage)');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: tint(theme.warm, 0.12),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={20} color={theme.warm} strokeWidth={2} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  fontWeight: '600',
                  color: theme.warm,
                }}
              >
                {t('profile.addFirstBike', { defaultValue: 'Add Your First Bike' })}
              </Text>
              <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
            </Pressable>
          ) : (
            <>
              {motorcycles.map((bike, index) => (
                <Pressable
                  key={bike.id}
                  onPress={() => {
                    triggerImpact();
                    router.push(`/(garage)/bike/${bike.id}`);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: pressed ? tint(theme.ink, 0.05) : 'transparent',
                    borderBottomWidth: index < motorcycles.length - 1 ? 0.5 : 0,
                    borderBottomColor: theme.line,
                  })}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      borderCurve: 'continuous',
                      backgroundColor: theme.surface2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Bike size={20} color={theme.ink3} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '600',
                        color: theme.ink,
                      }}
                      numberOfLines={1}
                    >
                      {bike.make} {bike.model}
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.ink3, marginTop: 1 }}>
                      {bike.year}
                      {bike.nickname ? ` · "${bike.nickname}"` : ''}
                    </Text>
                  </View>
                  {bike.isPrimary && (
                    <View
                      style={{
                        backgroundColor: `${palette.warning500}25`,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        borderCurve: 'continuous',
                        marginRight: 8,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: palette.warning500,
                        }}
                      >
                        {t('profile.primaryBike', { defaultValue: 'Primary' })}
                      </Text>
                    </View>
                  )}
                  <ChevronRight size={17} color={theme.ink3} strokeWidth={2} />
                </Pressable>
              ))}
              <Pressable
                onPress={onAddBike}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  gap: 6,
                  borderTopWidth: 0.5,
                  borderTopColor: theme.line,
                  backgroundColor: pressed ? tint(theme.ink, 0.05) : 'transparent',
                })}
              >
                {!isPro && motorcycles.length >= FREE_TIER_LIMITS.MAX_BIKES ? (
                  <Crown size={15} color={theme.purple} strokeWidth={2.5} />
                ) : (
                  <Plus size={15} color={theme.warm} strokeWidth={2.5} />
                )}
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.warm }}>
                  {t('profile.addAnotherBike', { defaultValue: 'Add Another Bike' })}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>

      {/* My Rides */}
      <ProfileNavCard
        delay={120}
        theme={theme}
        isDark={isDark}
        iconBg={tint(palette.accent500, 0.12)}
        icon={<Navigation size={22} color={palette.accent500} strokeWidth={2} />}
        title={t('profile.myRidesTitle', { defaultValue: 'My Rides' })}
        subtitle={t('profile.myRidesDescription', {
          defaultValue: 'Ride history, stats & route maps',
        })}
        onPress={() => router.push('/(tabs)/(profile)/rides')}
      />

      {/* Roads I've ridden — lifetime heatmap + annual recap */}
      <ProfileNavCard
        delay={125}
        theme={theme}
        isDark={isDark}
        iconBg={tint(theme.danger, 0.12)}
        icon={<Flame size={22} color={theme.danger} strokeWidth={2} />}
        title={t('profile.roadsTitle')}
        subtitle={t('profile.roadsSubtitle')}
        onPress={() => router.push('/(tabs)/(profile)/heatmap')}
      />

      {/* My Trips */}
      <ProfileNavCard
        delay={130}
        theme={theme}
        isDark={isDark}
        iconBg={tint(palette.warning500, 0.12)}
        icon={<MapRoute size={22} color={palette.warning500} strokeWidth={2} />}
        title={t('profile.myTripsTitle', { defaultValue: 'My Trips' })}
        subtitle={t('profile.myTripsDescription', {
          defaultValue: 'Drafts & published multi-day plans',
        })}
        onPress={() => router.push('/(profile)/trips')}
      />

      {/* Saved Routes */}
      <ProfileNavCard
        delay={140}
        theme={theme}
        isDark={isDark}
        iconBg={tint(theme.purple, 0.12)}
        icon={<Bookmark size={22} color={theme.purple} strokeWidth={2} />}
        title={t('profile.savedRoutesTitle')}
        subtitle={t('profile.savedRoutesSubtitle')}
        onPress={() => router.push('/(tabs)/(profile)/saved')}
      />

      {/* Learn */}
      <ProfileNavCard
        delay={160}
        theme={theme}
        isDark={isDark}
        iconBg={tint(theme.warm, 0.12)}
        icon={<BookOpen size={22} color={theme.warm} strokeWidth={2} />}
        title={t('tabs.learn')}
        subtitle={t('learn.profileDescription', {
          defaultValue: 'Articles, quizzes & motorcycle knowledge',
        })}
        onPress={() => router.push('/(tabs)/(learn)')}
      />
    </>
  );
}
