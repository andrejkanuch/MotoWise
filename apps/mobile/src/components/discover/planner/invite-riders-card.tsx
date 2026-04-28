import { palette } from '@motovault/design-system';
import { Plus, Sparkles } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useEditorialTheme } from '../../../theme/editorial';

interface Rider {
  id: string;
  name: string;
  color: string;
}

const MOCK_RIDERS: Rider[] = [
  { id: 'marek', name: 'Marek', color: palette.editorialInfo },
  { id: 'sara', name: 'Sara', color: palette.editorialSuccess },
  { id: 'kai', name: 'Kai', color: palette.signature500 },
];

interface InviteRidersCardProps {
  riders?: Rider[];
  availabilityText?: string;
  paceHint?: string;
}

export function InviteRidersCard({
  riders = MOCK_RIDERS,
  availabilityText = 'Marek & Sara are free Saturday. Kai is riding the Dolomites.',
  paceHint = 'Match pace: GS · Tiger · 890 Adv all spirited',
}: InviteRidersCardProps) {
  const { t } = useEditorialTheme();
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(300).delay(400)}
      style={{ gap: 8 }}
    >
      <Text
        style={{
          fontFamily: 'GeistMono',
          fontSize: 10.5,
          letterSpacing: 1.6,
          textTransform: 'uppercase',
          color: t.ink2,
          fontWeight: '600',
        }}
      >
        Invite riders
      </Text>

      <View
        style={{
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.line,
          borderRadius: 18,
          borderCurve: 'continuous',
          padding: 14,
        }}
      >
        {/* Avatar row */}
        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          {riders.map((rider, i) => (
            <View
              key={rider.id}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: rider.color,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: t.surface,
                marginLeft: i === 0 ? 0 : -8,
                zIndex: riders.length - i,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                {rider.name[0]}
              </Text>
            </View>
          ))}
          <Pressable
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: t.surface2,
              borderWidth: 2,
              borderStyle: 'dashed',
              borderColor: t.line,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -8,
            }}
          >
            <Plus size={14} color={t.ink3} />
          </Pressable>
        </View>

        {/* Availability text */}
        <Text style={{ fontSize: 12.5, color: t.ink2, lineHeight: 18, marginBottom: 4 }}>
          {availabilityText.split(/(Marek|Sara|Kai)/g).map((part) =>
            ['Marek', 'Sara', 'Kai'].includes(part) ? (
              <Text key={part} style={{ color: t.ink, fontWeight: '600' }}>
                {part}
              </Text>
            ) : (
              <Text key={part}>{part}</Text>
            ),
          )}
        </Text>

        {/* Pace hint */}
        {paceHint && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Sparkles size={11} color={t.warm} />
            <Text style={{ fontSize: 11, color: t.ink3 }}>{paceHint}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}
