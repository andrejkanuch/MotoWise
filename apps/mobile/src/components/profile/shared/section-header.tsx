import { palette } from '@motovault/design-system';
import { Text } from 'react-native';

interface SectionHeaderProps {
  label: string;
  tone?: 'default' | 'danger';
}

export function SectionHeader({ label, tone = 'default' }: SectionHeaderProps) {
  const color = tone === 'danger' ? palette.danger500 : palette.neutral500;

  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: '600',
        color,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 4,
      }}
    >
      {label}
    </Text>
  );
}
