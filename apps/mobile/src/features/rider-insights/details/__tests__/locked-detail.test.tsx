// The locked teasers' rounded shapes use the continuous corner curve, as every
// rounded shape in the app does.
jest.mock('react-native-mmkv', () => require('@/test/mocks').makeMmkvMock());
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('react-native-view-shot', () => ({ captureRef: () => new Promise(() => {}) }));

import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { TeaserBandBar, TeaserGrid } from '../locked-detail';

type JsonNode = { props: { style?: unknown }; children: (JsonNode | string)[] | null };

/** Every rendered view with rounded corners, flattened to its style. */
function roundedStyles(): Record<string, unknown>[] {
  const styles: Record<string, unknown>[] = [];
  const walk = (node: JsonNode | JsonNode[] | string | null) => {
    if (node === null || typeof node === 'string') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const style = (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
    if (typeof style.borderRadius === 'number' && style.borderRadius > 0) styles.push(style);
    for (const child of node.children ?? []) walk(child);
  };
  walk(screen.toJSON() as JsonNode | JsonNode[] | null);
  return styles;
}

describe('locked teasers', () => {
  it('round the band bar with the continuous curve', async () => {
    await render(<TeaserBandBar shares={[0.4, 0.3, 0.2, 0.1]} width={300} />);
    const rounded = roundedStyles();
    expect(rounded.length).toBeGreaterThan(0);
    for (const style of rounded) expect(style.borderCurve).toBe('continuous');
  });

  it('round the rhythm grid cells with the continuous curve', async () => {
    const levels = Array.from({ length: 7 }, () => [0, 1, 2, 3]);
    await render(<TeaserGrid levels={levels} width={300} />);
    const rounded = roundedStyles();
    expect(rounded).toHaveLength(28);
    for (const style of rounded) expect(style.borderCurve).toBe('continuous');
  });
});
