import { describe, expect, it } from 'vitest';
import { parseMetricValue } from './parse-metric-value';

describe('parseMetricValue — English number parsing (plan U2 / KTD 8)', () => {
  it('parses a bare decimal value', () => {
    expect(parseMetricValue('0.20')).toBe(0.2);
  });

  it('strips a unit suffix (valve clearance)', () => {
    expect(parseMetricValue('0.20 mm')).toBe(0.2);
  });

  it('parses a decimal capacity with unit', () => {
    expect(parseMetricValue('4.8 L')).toBe(4.8);
  });

  it('parses an integer with a unit (torque)', () => {
    expect(parseMetricValue('24 Nm')).toBe(24);
  });

  it('treats a comma as a thousands separator (English convention)', () => {
    expect(parseMetricValue('10,000 km')).toBe(10000);
  });

  it('handles dot-decimal with comma thousands grouping', () => {
    expect(parseMetricValue('1,250.5')).toBe(1250.5);
  });

  it('parses a pressure value in kPa', () => {
    expect(parseMetricValue('250 kPa')).toBe(250);
  });

  it('throws when there is no numeric token', () => {
    expect(() => parseMetricValue('N/A')).toThrow();
  });

  it('does NOT inflate a small decimal via a stray thousands rule (KTD 8 regression)', () => {
    // value_numeric is parsed once at extraction so a render-time reparse can't turn a
    // clearance/torque into a wrong-by-orders-of-magnitude value.
    expect(parseMetricValue('0.20 mm')).toBe(0.2);
    expect(parseMetricValue('0.20 mm')).not.toBe(20);
  });
});
