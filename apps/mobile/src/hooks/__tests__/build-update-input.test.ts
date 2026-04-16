import { buildUpdateInput, hasRootFields, mergeOneLevel } from '../build-update-input';

describe('mergeOneLevel', () => {
  it('preserves sibling top-level blocks when patching one block', () => {
    const current = {
      notifications: { newArticles: true, quizReminders: true },
      privacy: { analyticsEnabled: true },
    };
    const result = mergeOneLevel(current, { notifications: { newArticles: false } });
    expect(result).toEqual({
      notifications: { newArticles: false, quizReminders: true },
      privacy: { analyticsEnabled: true },
    });
  });

  it('shallow-merges scalars inside a single block', () => {
    const result = mergeOneLevel(
      { notifications: { a: 1, b: 2 } },
      { notifications: { b: 20, c: 30 } },
    );
    expect(result).toEqual({ notifications: { a: 1, b: 20, c: 30 } });
  });

  it('replaces scalars at the top level rather than merging them', () => {
    const result = mergeOneLevel({ onboardingStep: 1 }, { onboardingStep: 3 });
    expect(result).toEqual({ onboardingStep: 3 });
  });

  it('treats arrays as replace, not merge', () => {
    const result = mergeOneLevel({ tags: ['a', 'b'] }, { tags: ['c'] });
    expect(result).toEqual({ tags: ['c'] });
  });
});

describe('hasRootFields', () => {
  it('returns true when fullName is set', () => {
    expect(hasRootFields({ fullName: 'Rider' })).toBe(true);
  });
  it('returns true when measurementSystem is set', () => {
    expect(hasRootFields({ measurementSystem: 'imperial' })).toBe(true);
  });
  it('returns true when currency is set', () => {
    expect(hasRootFields({ currency: 'EUR' })).toBe(true);
  });
  it('returns false when only preferences are set', () => {
    expect(hasRootFields({ preferences: { notifications: { newArticles: true } } })).toBe(false);
  });
  it('returns false for an empty patch', () => {
    expect(hasRootFields({})).toBe(false);
  });
});

describe('buildUpdateInput', () => {
  it('merges a preferences patch onto the current cache entry', () => {
    const input = buildUpdateInput(
      { preferences: { notifications: { newArticles: false } } },
      {
        notifications: { newArticles: true, quizReminders: true },
        privacy: { analyticsEnabled: true },
      },
    );
    expect(input).toEqual({
      preferences: {
        notifications: { newArticles: false, quizReminders: true },
        privacy: { analyticsEnabled: true },
      },
    });
  });

  it('passes a root-level measurementSystem through with no preferences key', () => {
    const input = buildUpdateInput(
      { measurementSystem: 'imperial' },
      { notifications: { newArticles: true } },
    );
    expect(input).toEqual({ measurementSystem: 'imperial' });
    expect(input.preferences).toBeUndefined();
  });

  it('combines preferences + currency in a single input', () => {
    const input = buildUpdateInput(
      { currency: 'EUR', preferences: { privacy: { analyticsEnabled: false } } },
      { notifications: { newArticles: true } },
    );
    expect(input).toEqual({
      currency: 'EUR',
      preferences: {
        notifications: { newArticles: true },
        privacy: { analyticsEnabled: false },
      },
    });
  });

  it('sends the preferences patch as-is when the cache is empty (cache miss)', () => {
    const input = buildUpdateInput(
      { preferences: { notifications: { newArticles: true } } },
      undefined,
    );
    expect(input).toEqual({ preferences: { notifications: { newArticles: true } } });
  });

  it('omits fields that are not in the patch', () => {
    const input = buildUpdateInput({ fullName: 'Rider' }, { notifications: { newArticles: true } });
    expect(input).toEqual({ fullName: 'Rider' });
    expect(input.preferences).toBeUndefined();
    expect(input.currency).toBeUndefined();
    expect(input.measurementSystem).toBeUndefined();
  });
});
