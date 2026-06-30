import { findNegativePaywallSpacing, findUnboundedScrollStacks } from '../paywall-validation';

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

// Mirrors the exact stack that crashed Android in production: the root "Content"
// stack with `overflow: scroll` + `size.height.type: fill`.
// (Sentry MOTO-VAULT-REACT-NATIVE-1V)
const SCROLL_FILL_CONTENT_STACK = {
  id: 'uCaBPyA71Q',
  name: 'Content',
  type: 'stack',
  overflow: 'scroll',
  size: { height: { type: 'fill', value: null }, width: { type: 'fill', value: null } },
};

const SAFE_SCROLL_STACK = {
  ...SCROLL_FILL_CONTENT_STACK,
  size: { height: { type: 'fit', value: null }, width: { type: 'fill', value: null } },
};

describe('findUnboundedScrollStacks', () => {
  it('flags the scroll+fill stack that crashes Android (MOTO-VAULT-REACT-NATIVE-1V)', () => {
    const found = findUnboundedScrollStacks(wrapInPaywall(SCROLL_FILL_CONTENT_STACK));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      overflow: 'scroll',
      heightType: 'fill',
      componentId: 'uCaBPyA71Q',
    });
  });

  it('does not flag a scrollable stack with bounded (fit) height', () => {
    expect(findUnboundedScrollStacks(wrapInPaywall(SAFE_SCROLL_STACK))).toEqual([]);
  });

  it('does not flag a fill-height stack that is not scrollable', () => {
    const tree = { id: 'x', size: { height: { type: 'fill' } } };
    expect(findUnboundedScrollStacks(tree)).toEqual([]);
  });

  it('handles null/primitive nodes without throwing', () => {
    expect(findUnboundedScrollStacks(null)).toEqual([]);
    expect(findUnboundedScrollStacks(42)).toEqual([]);
    expect(findUnboundedScrollStacks('nope')).toEqual([]);
  });
});
