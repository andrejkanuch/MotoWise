import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MapPin, Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { PROFILE_ROUTE } from '../../config/routes';
import { getInitials } from '../../lib/user-avatar';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';

interface ProfileHeaderProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  publicUsername?: string | null;
  city?: string | null;
  bio?: string | null;
  isOwnProfile?: boolean;
}

/** Round rider avatar: the photo, or initials on the graphite surface. */
export function RiderAvatar({
  url,
  name,
  size,
}: {
  url?: string | null;
  name?: string | null;
  size: number;
}) {
  const { t } = useEditorialTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderCurve: 'continuous',
        backgroundColor: t.surface2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Text
        style={[
          type.bodyStrong,
          { fontSize: Math.max(12, Math.round(size * 0.36)), lineHeight: undefined, color: t.ink2 },
        ]}
      >
        {getInitials(name)}
      </Text>
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
          accessibilityLabel={name ?? undefined}
        />
      ) : null}
    </View>
  );
}

export function ProfileHeader({
  avatarUrl,
  displayName,
  publicUsername,
  city,
  bio,
  isOwnProfile,
}: ProfileHeaderProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();

  return (
    <Animated.View
      entering={FadeInUp.duration(280)}
      style={{ alignItems: 'center', gap: space.sm }}
    >
      <RiderAvatar url={avatarUrl} name={displayName ?? publicUsername} size={80} />

      <View style={{ alignItems: 'center', gap: 2 }}>
        {displayName ? (
          <Text
            style={[type.sheetTitle, { color: theme.ink, textAlign: 'center' }]}
            accessibilityRole="header"
          >
            {displayName}
          </Text>
        ) : null}
        {publicUsername ? (
          <Text style={[type.subhead, { color: theme.ink3 }]}>@{publicUsername}</Text>
        ) : null}
      </View>

      {city ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xxs }}>
          <MapPin size={14} color={theme.ink3} strokeWidth={1.8} />
          <Text style={[type.subhead, { color: theme.ink3 }]}>{city}</Text>
        </View>
      ) : null}

      {bio ? (
        <Text
          style={[
            type.body,
            { color: theme.ink2, textAlign: 'center', paddingHorizontal: space.xl },
          ]}
        >
          {bio}
        </Text>
      ) : null}

      {isOwnProfile ? (
        <Pressable
          onPress={() => {
            triggerImpact();
            router.push(PROFILE_ROUTE.EDIT_PROFILE);
          }}
          android_ripple={{ color: tint(theme.ink, 0.08) }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            minHeight: 44,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderCurve: 'continuous',
            overflow: 'hidden',
            backgroundColor: pressed ? theme.surface3 : theme.surface2,
          })}
          accessibilityRole="button"
          accessibilityLabel={t('community.editProfile')}
        >
          <Pencil size={14} color={theme.ink2} strokeWidth={1.8} />
          <Text style={[type.label, { color: theme.ink }]}>{t('common.edit')}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}
