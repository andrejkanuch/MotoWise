import { palette } from '@motovault/design-system';
import { Copy, Download, MoreHorizontal } from 'lucide-react-native';
import { memo, useCallback } from 'react';
import { Dimensions, Pressable, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
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

function WhatsAppIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Circle cx={15} cy={15} r={15} fill="#25D366" />
      <Path
        d="M 10.5 9.5 C 10.5 9.5 11.5 9 12.5 9.6 C 13.2 10 13.5 11.5 13.5 12.2 C 13.5 12.8 12.7 13.3 12.7 13.8 C 12.7 14.5 14 16 14.8 16.7 C 15.6 17.4 17 18.5 17.6 18.5 C 18.1 18.5 18.6 17.7 19.2 17.7 C 19.9 17.7 21.4 18 21.8 18.7 C 22.4 19.7 21.9 20.7 21.9 20.7 C 21.9 20.7 21.2 22 19.5 22 C 17.5 22 14.5 20.5 12.5 18.5 C 10.5 16.5 8.8 13.4 8.8 11.4 C 8.8 9.6 10.5 9.5 10.5 9.5 Z"
        fill="#fff"
      />
    </Svg>
  );
}

function MessagesIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Defs>
        <LinearGradient id="msg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#5BF675" />
          <Stop offset="100%" stopColor="#3BD83D" />
        </LinearGradient>
      </Defs>
      <Circle cx={14} cy={14} r={14} fill="url(#msg)" />
      <Path
        d="M 7 13 C 7 10 9.5 8.5 14 8.5 C 18.5 8.5 21 10 21 13 C 21 16 18.5 17.5 14 17.5 C 13.2 17.5 12.6 17.45 12.0 17.35 L 8.5 19 L 9.5 16.5 C 8 15.7 7 14.5 7 13 Z"
        fill="#fff"
      />
    </Svg>
  );
}

function MotoVaultIcon() {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30">
      <Defs>
        <LinearGradient id="mv" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#3a342a" />
          <Stop offset="100%" stopColor="#1f1c18" />
        </LinearGradient>
      </Defs>
      <Circle cx={15} cy={15} r={15} fill="url(#mv)" />
      <Path
        d="M8 19 L10 12 L13 17 L15 11 L17 17 L20 12 L22 19"
        fill="none"
        stroke={palette.shareCopperSoft}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

type DestinationItem = {
  id: ShareDestination;
  label: string;
  icon: React.ReactNode;
};

const DESTINATIONS: DestinationItem[] = [
  { id: 'instagramStory', label: 'Instagram\nStory', icon: <InstagramIcon /> },
  { id: 'instagramMessages', label: 'Instagram\nMessages', icon: <InstagramDmIcon /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <WhatsAppIcon /> },
  { id: 'message', label: 'Message', icon: <MessagesIcon /> },
  { id: 'motovaultDm', label: 'MotoVault\nDM', icon: <MotoVaultIcon /> },
  {
    id: 'saveImage',
    label: 'Save image',
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
  {
    id: 'copyLink',
    label: 'Copy link',
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
        <Copy size={22} color="#fff" />
      </View>
    ),
  },
  {
    id: 'systemShare',
    label: 'More',
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
        <MoreHorizontal size={22} color="#fff" />
      </View>
    ),
  },
];

export const ShareDestinationGrid = memo(function ShareDestinationGrid({
  disabled,
  onDestinationPress,
}: ShareDestinationGridProps) {
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
        Share to
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
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);

  // Each cell is 1/5 of the grid width minus padding
  const cellWidth = (Dimensions.get('window').width - 24 - 16) / 5;

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      accessibilityLabel={`Share to ${item.label.replace('\n', ' ')}`}
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
        {item.label}
      </Text>
    </Pressable>
  );
});
