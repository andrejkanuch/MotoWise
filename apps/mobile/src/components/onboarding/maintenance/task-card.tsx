import type { OemSchedulesPreviewQuery } from '@motovault/graphql';
import { Droplets, Fuel, Gauge, Shield, Sun, Thermometer, Wrench, Zap } from 'lucide-react-native';
import { Text, View } from 'react-native';

type OemTask = OemSchedulesPreviewQuery['oemSchedulesPreview'][number];

const PRIORITY_TONE = {
  critical: { label: 'Critical', color: '#C4634A', bg: 'rgba(196, 99, 74, 0.15)' },
  high: { label: 'Critical', color: '#C4634A', bg: 'rgba(196, 99, 74, 0.15)' },
  medium: { label: 'Recommended', color: '#D4884A', bg: 'rgba(212, 136, 74, 0.15)' },
  low: { label: 'Optional', color: '#6B8BB2', bg: 'rgba(107, 139, 178, 0.15)' },
} as const;

function getTaskIcon(taskName: string) {
  const lower = taskName.toLowerCase();
  if (lower.includes('oil') || lower.includes('filter')) return Fuel;
  if (lower.includes('chain') || lower.includes('lube')) return Droplets;
  if (lower.includes('tire') || lower.includes('tyre')) return Gauge;
  if (lower.includes('brake')) return Shield;
  if (lower.includes('valve')) return Wrench;
  if (lower.includes('air')) return Sun;
  if (lower.includes('spark') || lower.includes('plug')) return Zap;
  if (lower.includes('coolant') || lower.includes('radiator')) return Thermometer;
  if (lower.includes('battery')) return Zap;
  return Wrench;
}

function formatInterval(task: OemTask): string {
  if (task.intervalKm && task.intervalDays) {
    return `Every ${task.intervalKm.toLocaleString()} km / ${Math.round(task.intervalDays / 30)} mo`;
  }
  if (task.intervalKm) return `Every ${task.intervalKm.toLocaleString()} km`;
  if (task.intervalDays) {
    const months = Math.round(task.intervalDays / 30);
    return months >= 12
      ? `Every ${Math.round(months / 12)} year${months >= 24 ? 's' : ''}`
      : `Every ${months} months`;
  }
  return 'As needed';
}

interface TaskCardProps {
  task: OemTask;
  brandColor: string;
  dragDirection: 'left' | 'right' | null;
}

export function TaskCard({ task, brandColor, dragDirection }: TaskCardProps) {
  const tone = PRIORITY_TONE[task.priority as keyof typeof PRIORITY_TONE] ?? PRIORITY_TONE.medium;
  const Icon = getTaskIcon(task.taskName);
  const interval = formatInterval(task);

  const borderColor =
    dragDirection === 'right'
      ? '#4eba6f'
      : dragDirection === 'left'
        ? '#C4634A'
        : 'rgba(255,255,255,0.1)';

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 22,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: '#1f1a14',
        borderWidth: 1.5,
        borderColor,
        padding: 20,
        paddingBottom: 18,
        justifyContent: 'space-between',
      }}
    >
      {/* Priority badge + OEM label */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 4,
            paddingHorizontal: 9,
            borderRadius: 999,
            backgroundColor: tone.bg,
            borderWidth: 1,
            borderColor: `${tone.color}40`,
          }}
        >
          <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: tone.color }} />
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 9.5,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              color: tone.color,
            }}
          >
            {tone.label}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 10,
            color: 'rgba(255,255,255,0.42)',
            letterSpacing: 1,
          }}
        >
          OEM
        </Text>
      </View>

      {/* Icon */}
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          borderCurve: 'continuous',
          backgroundColor: brandColor,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          ...(process.env.EXPO_OS === 'ios'
            ? {
                shadowColor: brandColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.55,
                shadowRadius: 12,
              }
            : {}),
        }}
      >
        <Icon size={26} color="#1a0f08" strokeWidth={1.8} />
      </View>

      {/* Title */}
      <Text
        style={{
          fontFamily: 'InstrumentSerif-Italic',
          fontSize: 26,
          lineHeight: 28,
          letterSpacing: -0.4,
          color: '#fff',
          marginBottom: 12,
        }}
      >
        {task.taskName}
      </Text>

      {/* Interval */}
      <View style={{ marginBottom: 12 }}>
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 9,
            fontWeight: '600',
            letterSpacing: 1.3,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
            marginBottom: 4,
          }}
        >
          Interval
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff', letterSpacing: -0.1 }}>
          {interval}
        </Text>
      </View>

      {/* Description */}
      {task.description && (
        <Text
          style={{
            fontSize: 12.5,
            lineHeight: 18,
            color: 'rgba(255,255,255,0.78)',
            marginBottom: 10,
          }}
        >
          {task.description}
        </Text>
      )}

      {/* Swipe stamps */}
      {dragDirection === 'right' && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            right: 20,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 8,
            borderWidth: 3,
            borderColor: '#4eba6f',
            backgroundColor: 'rgba(0,0,0,0.4)',
            transform: [{ rotate: '-12deg' }],
          }}
        >
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontWeight: '800',
              fontSize: 16,
              letterSpacing: 2,
              color: '#4eba6f',
            }}
          >
            ADD
          </Text>
        </View>
      )}
      {dragDirection === 'left' && (
        <View
          style={{
            position: 'absolute',
            top: 60,
            left: 20,
            paddingVertical: 6,
            paddingHorizontal: 14,
            borderRadius: 8,
            borderWidth: 3,
            borderColor: '#C4634A',
            backgroundColor: 'rgba(0,0,0,0.4)',
            transform: [{ rotate: '12deg' }],
          }}
        >
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontWeight: '800',
              fontSize: 16,
              letterSpacing: 2,
              color: '#C4634A',
            }}
          >
            SKIP
          </Text>
        </View>
      )}
    </View>
  );
}
