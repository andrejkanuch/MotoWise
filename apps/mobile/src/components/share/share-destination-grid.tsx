import { palette } from '@motovault/design-system';
import { Download } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { ShareDestination } from './share-card-types';

interface ShareDestinationGridProps {
  disabled: boolean;
  onDestinationPress: (destination: ShareDestination) => void;
}

// Brand icon components — simplified outlines for trademark compliance

function InstagramIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Defs>
        <RadialGradient id="ig" cx="25%" cy="105%" r="120%">
          <Stop offset="0%" stopColor="#FFD25F" />
          <Stop offset="20%" stopColor="#F9A11B" />
          <Stop offset="45%" stopColor="#ED4F5C" />
          <Stop offset="70%" stopColor="#C42E91" />
          <Stop offset="100%" stopColor="#7234C4" />
        </RadialGradient>
      </Defs>
      <Rect x={1} y={1} width={24} height={24} rx={7} fill="url(#ig)" />
      <Rect x={5} y={5} width={16} height={16} rx={5} fill="none" stroke="#fff" strokeWidth={1.8} />
      <Circle cx={13} cy={13} r={4} fill="none" stroke="#fff" strokeWidth={1.8} />
      <Circle cx={18.6} cy={7.4} r={1.1} fill="#fff" />
    </Svg>
  );
}

function InstagramDmIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Defs>
        <RadialGradient id="igdm" cx="20%" cy="105%" r="125%">
          <Stop offset="0%" stopColor="#FFD25F" />
          <Stop offset="22%" stopColor="#F9A11B" />
          <Stop offset="48%" stopColor="#ED4F5C" />
          <Stop offset="72%" stopColor="#C42E91" />
          <Stop offset="100%" stopColor="#7234C4" />
        </RadialGradient>
      </Defs>
      <Rect x={1} y={1} width={24} height={24} rx={7} fill="url(#igdm)" />
      <Path
        d="M 8 13.2 L 18.5 8.5 L 15.5 18.5 L 13 14.5 L 8 13.2 Z M 13 14.5 L 18.5 8.5"
        fill="none"
        stroke="#fff"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

type DestinationI18nKey =
  | 'shareSheet.instagramStory'
  | 'shareSheet.instagramMessages'
  | 'shareSheet.saveImage';

type DestinationItem = {
  id: ShareDestination;
  i18nKey: DestinationI18nKey;
  icon: React.ReactNode;
};

const DESTINATIONS: DestinationItem[] = [
  { id: 'instagramStory', i18nKey: 'shareSheet.instagramStory', icon: <InstagramIcon /> },
  { id: 'instagramMessages', i18nKey: 'shareSheet.instagramMessages', icon: <InstagramDmIcon /> },
  {
    id: 'saveImage',
    i18nKey: 'shareSheet.saveImage',
    icon: (
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.10)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Download size={22} color="#fff" />
      </View>
    ),
  },
];

export const ShareDestinationGrid = memo(function ShareDestinationGrid({
  disabled,
  onDestinationPress,
}: ShareDestinationGridProps) {
  const { t } = useTranslation();

  return (
    <View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: palette.shareTextLight,
          letterSpacing: -0.11,
          paddingHorizontal: 22,
          paddingTop: 4,
          paddingBottom: 12,
        }}
      >
        {t('shareSheet.shareTo')}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          paddingHorizontal: 12,
          columnGap: 4,
          rowGap: 18,
          paddingBottom: 26,
        }}
      >
        {DESTINATIONS.map((dest) => (
          <DestinationButton
            key={dest.id}
            item={dest}
            disabled={disabled}
            onPress={onDestinationPress}
          />
        ))}
      </View>
    </View>
  );
});

const DestinationButton = memo(function DestinationButton({
  item,
  disabled,
  onPress,
}: {
  item: DestinationItem;
  disabled: boolean;
  onPress: (id: ShareDestination) => void;
}) {
  const { t } = useTranslation();
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);

  // Each cell is 1/3 of the grid width minus padding
  const cellWidth = (Dimensions.get('window').width - 24 - 16) / 3;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityLabel={`${t('shareSheet.shareTo')} ${t(item.i18nKey).replace('\n', ' ')}`}
      accessibilityRole="button"
      style={{
        width: cellWidth,
        alignItems: 'center',
        gap: 8,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ width: 50, height: 50, justifyContent: 'center', alignItems: 'center' }}>
        {item.icon}
      </View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '500',
          color: 'rgba(255,255,255,0.82)',
          textAlign: 'center',
          letterSpacing: -0.055,
          lineHeight: 13,
          maxWidth: 64,
        }}
      >
        {t(item.i18nKey)}
      </Text>
    </Pressable>
  );
});
