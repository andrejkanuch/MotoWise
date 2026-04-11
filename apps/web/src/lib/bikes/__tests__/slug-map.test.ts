import { describe, expect, it } from 'vitest';
import { makeSlug, modelSlug, unslug } from '../slug-map';

describe('makeSlug / modelSlug', () => {
  it('lowercases plain names', () => {
    expect(makeSlug('Yamaha')).toBe('yamaha');
    expect(makeSlug('BMW')).toBe('bmw');
  });

  it('handles hyphenated names', () => {
    expect(makeSlug('Harley-Davidson')).toBe('harley-davidson');
    expect(modelSlug('YZF-R1')).toBe('yzf-r1');
  });

  it('handles multi-word names with spaces', () => {
    expect(makeSlug('Moto Guzzi')).toBe('moto-guzzi');
    expect(makeSlug('Royal Enfield')).toBe('royal-enfield');
    expect(makeSlug('MV Agusta')).toBe('mv-agusta');
  });

  it('strips diacritics', () => {
    expect(modelSlug('Aprilia Tuono V4 1100 Factory')).toBe('aprilia-tuono-v4-1100-factory');
    expect(makeSlug('Citroën')).toBe('citroen');
    expect(modelSlug('Café Racer')).toBe('cafe-racer');
  });

  it('collapses multiple separators and trims edges', () => {
    expect(makeSlug('  Harley  --  Davidson  ')).toBe('harley-davidson');
    expect(makeSlug('---BMW---')).toBe('bmw');
  });

  it('produces empty string on punctuation-only input', () => {
    expect(makeSlug('---')).toBe('');
    expect(makeSlug('!!!')).toBe('');
  });
});

describe('unslug', () => {
  it('title-cases slug segments', () => {
    expect(unslug('harley-davidson')).toBe('Harley Davidson');
    expect(unslug('yzf-r1')).toBe('Yzf R1');
    expect(unslug('moto-guzzi')).toBe('Moto Guzzi');
  });

  it('is idempotent under makeSlug for simple ascii names', () => {
    const original = 'Moto Guzzi';
    const slug = makeSlug(original);
    const roundTripped = unslug(slug);
    expect(makeSlug(roundTripped)).toBe(slug);
  });

  it('handles empty and single-segment slugs', () => {
    expect(unslug('')).toBe('');
    expect(unslug('bmw')).toBe('Bmw');
  });
});
