/**
 * Diagnosis severity as a plate-state chip. Severity borrows the plate triad so
 * a rider reads it the way they read a bike: bone = fine, signal = soon,
 * red = now. Ink on every state is `onPlate`. The `BikePlate` itself stays a
 * bike-only object.
 */

import { DiagnosticSeverity } from '@motovault/graphql';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { type EditorialTokens, useEditorialTheme } from '../../theme/editorial';
import { radius, SYSTEM_WEIGHT, space, type } from '../../theme/type';

type SeverityTone = keyof Pick<
  EditorialTokens,
  'plateReady' | 'plateDue' | 'plateOverdue' | 'surface3'
>;

const SEVERITY_LABEL_KEY = {
  [DiagnosticSeverity.Low]: 'diagnose.severityLevel.low',
  [DiagnosticSeverity.Medium]: 'diagnose.severityLevel.medium',
  [DiagnosticSeverity.High]: 'diagnose.severityLevel.high',
  [DiagnosticSeverity.Critical]: 'diagnose.severityLevel.critical',
} as const satisfies Record<DiagnosticSeverity, string>;

const SEVERITY_TONE = {
  [DiagnosticSeverity.Low]: 'plateReady',
  [DiagnosticSeverity.Medium]: 'plateDue',
  [DiagnosticSeverity.High]: 'plateOverdue',
  [DiagnosticSeverity.Critical]: 'plateOverdue',
} as const satisfies Record<DiagnosticSeverity, SeverityTone>;

/** Severities that warrant the "consult a mechanic" prompt. */
export const URGENT_SEVERITIES: ReadonlySet<DiagnosticSeverity> = new Set([
  DiagnosticSeverity.High,
  DiagnosticSeverity.Critical,
]);

export const SEVERITY_CHIP_SIZE = {
  COMPACT: 'compact',
  REGULAR: 'regular',
} as const;
type SeverityChipSize = (typeof SEVERITY_CHIP_SIZE)[keyof typeof SEVERITY_CHIP_SIZE];

const SIZE_STYLE = {
  [SEVERITY_CHIP_SIZE.COMPACT]: { padH: space.xs, padV: 2, text: type.caption },
  [SEVERITY_CHIP_SIZE.REGULAR]: { padH: space.sm, padV: space.xxs, text: type.label },
} as const;

/** The translated severity word, or the "not rated" word for a missing value. */
export function useSeverityLabel(severity: DiagnosticSeverity | null | undefined): string {
  const { t } = useTranslation();
  return severity ? t(SEVERITY_LABEL_KEY[severity]) : t('diagnose.severityUnrated');
}

interface SeverityChipProps {
  severity: DiagnosticSeverity | null | undefined;
  /** Replaces the severity word (e.g. "Analyzing" while a diagnosis is processing). */
  label?: string;
  size?: SeverityChipSize;
}

export function SeverityChip({
  severity,
  label,
  size = SEVERITY_CHIP_SIZE.COMPACT,
}: SeverityChipProps) {
  const { t: theme, isDark } = useEditorialTheme();
  const severityLabel = useSeverityLabel(severity);
  const s = SIZE_STYLE[size];
  const rated = severity != null && label == null;
  const fill = rated ? theme[SEVERITY_TONE[severity]] : theme.surface3;
  const ink = rated ? theme.onPlate : theme.ink2;
  // Bone and the light ground are nearly the same value (1.1:1), so on light
  // surfaces every chip carries a hairline to hold its shape.
  const edge = isDark ? 'transparent' : theme.line;

  return (
    <View
      style={{
        backgroundColor: fill,
        borderWidth: 1,
        borderColor: edge,
        borderRadius: radius.chip,
        borderCurve: 'continuous',
        paddingHorizontal: s.padH,
        paddingVertical: s.padV,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={[s.text, SYSTEM_WEIGHT.semibold, { color: ink }]} numberOfLines={1}>
        {label ?? severityLabel}
      </Text>
    </View>
  );
}
