import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Plus, Route } from 'lucide-react-native';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { useEditorialTheme } from '../../../theme/editorial';

interface DraftTrip {
  id: string;
  title: string;
  stops: number;
  km: number;
  progress: number;
  note: string;
  color: string;
}

const MOCK_DRAFTS: DraftTrip[] = [
  {
    id: '1',
    title: 'Dolomites · 3 days',
    stops: 4,
    km: 612,
    progress: 0.7,
    note: 'Need to confirm Cortina hotel',
    color: palette.editorialInfo,
  },
  {
    id: '2',
    title: 'Sunday coffee loop',
    stops: 2,
    km: 84,
    progress: 0.4,
    note: 'Saved Tue',
    color: palette.signature500,
  },
  {
    id: '3',
    title: "Marek's birthday ride",
    stops: 3,
    km: 186,
    progress: 0.85,
    note: 'Waiting on Sara · 4/6 in',
    color: palette.editorialSuccess,
  },
];

function DraftTripCard({ draft, onPress }: { draft: DraftTrip; onPress: () => void }) {
  const { t } = useEditorialTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 200,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 12,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: draft.color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Route size={13} color="#fff" />
        </View>
        <Text
          style={{
            fontFamily: 'GeistMono',
            fontSize: 9,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            color: t.ink3,
          }}
        >
          Draft
        </Text>
      </View>

      <Text
        style={{
          fontSize: 13.5,
          fontWeight: '600',
          color: t.ink,
          lineHeight: 16,
          letterSpacing: -0.1,
          marginBottom: 4,
        }}
        numberOfLines={1}
      >
        {draft.title}
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <Text style={{ fontSize: 10.5, color: t.ink3 }}>{draft.stops} stops</Text>
        <Text style={{ fontSize: 10.5, color: t.ink3, opacity: 0.4 }}>·</Text>
        <Text style={{ fontSize: 10.5, color: t.ink3 }}>{draft.km} km</Text>
      </View>

      {/* Progress bar */}
      <View
        style={{
          height: 3,
          borderRadius: 2,
          backgroundColor: t.bg2,
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${draft.progress * 100}%`,
            backgroundColor: draft.color,
          }}
        />
      </View>

      <Text style={{ fontSize: 10.5, color: t.ink3, lineHeight: 14 }} numberOfLines={2}>
        {draft.note}
      </Text>
    </Pressable>
  );
}

function NewDraftCard({ onPress }: { onPress: () => void }) {
  const { t } = useEditorialTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 130,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: t.line,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 12,
        justifyContent: 'space-between',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: t.surface2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Plus size={14} color={t.ink2} />
      </View>
      <View style={{ marginTop: 12 }}>
        <Text
          style={{
            fontSize: 12.5,
            fontWeight: '600',
            color: t.ink2,
            lineHeight: 15,
            marginBottom: 4,
          }}
        >
          Blank trip
        </Text>
        <Text style={{ fontSize: 10.5, color: t.ink3, lineHeight: 14 }}>Start from scratch</Text>
      </View>
    </Pressable>
  );
}

interface DraftTripStripProps {
  drafts?: DraftTrip[];
}

export function DraftTripStrip({ drafts = MOCK_DRAFTS }: DraftTripStripProps) {
  const { t } = useEditorialTheme();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const handleDraftPress = useCallback((_draftId: string) => {
    if (process.env.EXPO_OS === 'ios') Haptics.selectionAsync();
    // TODO: navigate to draft detail when backend supports it
  }, []);

  const handleNewDraft = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/(modals)/create-trip');
  }, [router]);

  return (
    <Animated.View
      entering={reducedMotion ? undefined : FadeInUp.duration(300).delay(200)}
      style={{ gap: 10 }}
    >
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}
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
          Continue planning
        </Text>
        <Text
          style={{
            fontFamily: 'GeistMono',
            fontSize: 10.5,
            color: t.ink3,
          }}
        >
          {drafts.length} drafts
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {drafts.map((draft) => (
          <DraftTripCard key={draft.id} draft={draft} onPress={() => handleDraftPress(draft.id)} />
        ))}
        <NewDraftCard onPress={handleNewDraft} />
      </ScrollView>
    </Animated.View>
  );
}
