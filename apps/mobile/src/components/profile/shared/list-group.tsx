import { palette } from '@motovault/design-system';
import { Children, type ReactNode } from 'react';
import { useColorScheme, View, type ViewStyle } from 'react-native';

interface ListGroupProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function ListGroup({ children, style }: ListGroupProps) {
  const isDark = useColorScheme() === 'dark';
  // `Children.toArray` already strips null/undefined/false/true children.
  const items = Children.toArray(children);
  const lastIndex = items.length - 1;

  return (
    <View
      style={[
        {
          backgroundColor: isDark ? palette.neutral800 : palette.white,
          borderRadius: 16,
          borderCurve: 'continuous',
          overflow: 'hidden',
          boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
        },
        style,
      ]}
    >
      {items.map((child, index) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: list-group children are position-indexed by design
          key={index}
          style={{
            borderBottomWidth: index === lastIndex ? 0 : 0.5,
            borderBottomColor: isDark ? palette.dividerDark : palette.dividerLight,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}
