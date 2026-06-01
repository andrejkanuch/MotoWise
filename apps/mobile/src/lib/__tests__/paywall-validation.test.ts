import { findNegativePaywallSpacing } from '../paywall-validation';

// Mirrors the exact component that crashed Android in production: a pill-shaped
// badge with a negative top margin. (Sentry MOTO-VAULT-REACT-NATIVE-1N)
const BADGE_WITH_NEGATIVE_MARGIN = {
  id: '546938d7c8',
  name: 'Text Block',
  type: 'stack',
  shape: { type: 'pill' },
  margin: { top: -9, bottom: 6, leading: 0, trailing: 0 },
  padding: { top: 3, bottom: 3, leading: 8, trailing: 8 },
  background: { type: 'color', value: { dark: { type: 'hex', value: '#FAC775ff' } } },
};

const SAFE_BADGE = {
  ...BADGE_WITH_NEGATIVE_MARGIN,
  margin: { top: 0, bottom: 6, leading: 0, trailing: 0 },
};

function wrapInPaywall(badge: unknown) {
  return {
    components_config: {
      base: {
        stack: {
          id: 'root-stack',
          margin: { top: 0, bottom: 0, leading: 0, trailing: 0 },
          padding: { top: 0, bottom: 0, leading: 20, trailing: 20 },
          components: [{ id: 'package-card', components: [badge] }],
        },
      },
    },
  };
}

describe('findNegativePaywallSpacing', () => {
  it('flags the negative top margin that crashes Android (MOTO-VAULT-REACT-NATIVE-1N)', () => {
    const found = findNegativePaywallSpacing(wrapInPaywall(BADGE_WITH_NEGATIVE_MARGIN));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      spacing: 'margin',
      edge: 'top',
      value: -9,
      componentId: '546938d7c8',
    });
    expect(found[0].path).toContain('margin.top');
  });

  it('returns empty for a tree with all non-negative spacing', () => {
    expect(findNegativePaywallSpacing(wrapInPaywall(SAFE_BADGE))).toEqual([]);
  });

  it('does not flag zero (the safe replacement value)', () => {
    expect(findNegativePaywallSpacing({ margin: { top: 0, bottom: 0 } })).toEqual([]);
  });

  it('catches negatives in padding as well as margin', () => {
    const found = findNegativePaywallSpacing({
      id: 'x',
      padding: { top: 0, bottom: -4, leading: 0, trailing: 0 },
    });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ spacing: 'padding', edge: 'bottom', value: -4 });
  });

  it('catches multiple negatives across nested components and reports each path', () => {
    const tree = {
      id: 'a',
      margin: { top: -1 },
      components: [
        { id: 'b', padding: { leading: -2 } },
        { id: 'c', margin: { trailing: 0 } },
      ],
    };
    const found = findNegativePaywallSpacing(tree);
    expect(found).toHaveLength(2);
    expect(found.map((f) => f.componentId).sort()).toEqual(['a', 'b']);
  });

  it('handles null/primitive nodes without throwing', () => {
    expect(findNegativePaywallSpacing(null)).toEqual([]);
    expect(findNegativePaywallSpacing(42)).toEqual([]);
    expect(findNegativePaywallSpacing('nope')).toEqual([]);
  });
});
