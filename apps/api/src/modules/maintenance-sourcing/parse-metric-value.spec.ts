import { describe, expect, it } from 'vitest';
import { parseMetricValue } from './parse-metric-value';

describe('parseMetricValue — decimal-comma parsing (plan U2 / KTD 8)', () => {
  it('parses a bare decimal-comma value', () => {
    expect(parseMetricValue('0,20')).toBe(0.2);
  });

  it('strips a unit suffix (valve clearance)', () => {
    expect(parseMetricValue('0,20 mm')).toBe(0.2);
  });

  it('parses a decimal-comma capacity with unit', () => {
    expect(parseMetricValue('4,8 L')).toBe(4.8);
  });

  it('parses an integer with a unit (torque)', () => {
    expect(parseMetricValue('24 Nm')).toBe(24);
  });

  it('handles es thousands grouping with comma decimal', () => {
    expect(parseMetricValue('1.250,5')).toBe(1250.5);
  });

  it('tolerates an already dot-decimal value', () => {
    expect(parseMetricValue('0.20')).toBe(0.2);
  });

  it('handles dot-decimal with comma thousands grouping', () => {
    expect(parseMetricValue('1,250.5')).toBe(1250.5);
  });

  it('throws when there is no numeric token', () => {
    expect(() => parseMetricValue('N/A')).toThrow();
  });

  it('does NOT confuse a decimal-comma slip into a 100x value (KTD 8 regression)', () => {
    // The whole reason value_numeric is parsed once: a render-time locale reparse of '0,20'
    // as dot-thousands would yield 20 (a 100x-wrong torque/clearance). Parse it correctly here.
    expect(parseMetricValue('0,20 mm')).not.toBe(20);
    expect(parseMetricValue('0,20 mm')).toBe(0.2);
  });
});
