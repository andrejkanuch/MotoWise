import { Pressable, ScrollView, Text } from 'react-native';
import { useEditorialTheme } from '../../theme/editorial';

export type FocusTab = 'stats' | 'trip' | 'history';

const TABS: { id: FocusTab; label: string }[] = [
  { id: 'stats', label: 'This month' },
  { id: 'trip', label: 'Upcoming trip' },
  { id: 'history', label: 'Ride history' },
];

interface FocusPickerProps {
  active: FocusTab;
  onSelect: (tab: FocusTab) => void;
}

export function FocusPicker({ active, onSelect }: FocusPickerProps) {
  const { t: theme } = useEditorialTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 6, paddingBottom: 2 }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 13,
              borderRadius: 999,
              backgroundColor: isActive ? theme.ink : 'transparent',
              borderWidth: 1,
              borderColor: isActive ? theme.ink : theme.line,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 0.2,
                color: isActive ? theme.bg : theme.ink3,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
