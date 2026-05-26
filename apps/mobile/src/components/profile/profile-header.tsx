import { palette } from '@motovault/design-system';
import { router } from 'expo-router';
import { MapPin, Pencil } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { triggerImpact } from '../../utils/haptics';

interface ProfileHeaderProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  publicUsername?: string | null;
  city?: string | null;
  bio?: string | null;
  isOwnProfile?: boolean;
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
  const isDark = useColorScheme() === 'dark';

  const nameColor = isDark ? palette.white : palette.neutral950;
  const usernameColor = isDark ? palette.neutral400 : palette.neutral500;
  const bioColor = isDark ? palette.neutral300 : palette.neutral600;
  const cityColor = isDark ? palette.neutral400 : palette.neutral500;
  const avatarBg = isDark ? palette.neutral800 : palette.neutral200;

  const initials = (displayName ?? publicUsername ?? '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Animated.View entering={FadeInUp.duration(280)} style={{ alignItems: 'center', gap: 12 }}>
      {/* Avatar */}
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          borderCurve: 'continuous',
          backgroundColor: avatarBg,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 80, height: 80 }}
            accessibilityLabel={displayName ?? publicUsername ?? 'Avatar'}
          />
        ) : (
          <Text style={{ fontSize: 28, fontWeight: '700', color: usernameColor }}>{initials}</Text>
        )}
      </View>

      {/* Name + username */}
      <View style={{ alignItems: 'center', gap: 2 }}>
        {displayName && (
          <Text style={{ fontSize: 22, fontWeight: '700', color: nameColor }}>{displayName}</Text>
        )}
        {publicUsername && (
          <Text style={{ fontSize: 15, color: usernameColor }}>@{publicUsername}</Text>
        )}
      </View>

      {/* City */}
      {city && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MapPin size={14} color={cityColor} strokeWidth={1.8} />
          <Text style={{ fontSize: 14, color: cityColor }}>{city}</Text>
        </View>
      )}

      {/* Bio */}
      {bio && (
        <Text
          style={{
            fontSize: 15,
            color: bioColor,
            textAlign: 'center',
            lineHeight: 21,
            paddingHorizontal: 24,
          }}
        >
          {bio}
        </Text>
      )}

      {/* Edit button — own profile only */}
      {isOwnProfile && (
        <Pressable
          onPress={() => {
            triggerImpact();
            router.push('/(tabs)/(profile)/edit-profile');
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: isDark ? palette.neutral700 : palette.neutral300,
            backgroundColor: pressed
              ? isDark
                ? palette.surfacePressed
                : palette.neutral100
              : 'transparent',
          })}
          accessibilityRole="button"
          accessibilityLabel={t('community.editProfile')}
        >
          <Pencil size={14} color={usernameColor} strokeWidth={1.8} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: usernameColor }}>
            {t('common.edit')}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}
