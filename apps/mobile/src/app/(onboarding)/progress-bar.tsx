import { View } from 'react-native';

const STEP_KEYS = ['s1', 's2', 's3', 's4'] as const;

export function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 24, paddingTop: 16 }}>
      {STEP_KEYS.slice(0, total).map((key, i) => (
        <View
          key={key}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i < step ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </View>
  );
}
