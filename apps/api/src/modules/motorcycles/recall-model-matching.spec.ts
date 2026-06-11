import { describe, expect, it } from 'vitest';
import { buildCandidateModels, isModelNameMatch } from './recall-model-matching';

describe('isModelNameMatch', () => {
  it('matches when one name contains the other (recall DB prefixes the code)', () => {
    expect(isModelNameMatch('Africa Twin', 'CRF1100 AFRICA TWIN')).toBe(true);
  });

  it('matches across spacing and punctuation differences', () => {
    expect(isModelNameMatch('R1250GS', 'R 1250 GS')).toBe(true);
    expect(isModelNameMatch('YZF-R1', 'YZFR1')).toBe(true);
  });

  it('matches short code prefixes like PCX ⊂ PCX150', () => {
    expect(isModelNameMatch('PCX', 'PCX150')).toBe(true);
  });

  it('matches on two shared tokens when neither contains the other', () => {
    expect(isModelNameMatch('Africa Twin Adventure Sports', 'CRF1100 AFRICA TWIN')).toBe(true);
    expect(isModelNameMatch('Rebel 500', 'CMX500 REBEL')).toBe(true);
  });

  it('rejects different models of the same family (single shared token)', () => {
    expect(isModelNameMatch('Ninja 650', 'NINJA 400')).toBe(false);
    expect(isModelNameMatch('Vulcan 900', 'NINJA 400')).toBe(false);
    expect(isModelNameMatch('Rebel 500', 'CMX1100')).toBe(false);
  });

  it('rejects unrelated names', () => {
    expect(isModelNameMatch('Gold Wing', 'GL1800')).toBe(false); // needs the alias table
    expect(isModelNameMatch('', 'CRF1100')).toBe(false);
  });
});

describe('buildCandidateModels', () => {
  it('keeps the stored name as the first candidate', () => {
    const candidates = buildCandidateModels('Honda', 'CB500X', []);
    expect(candidates[0]).toBe('CB500X');
  });

  it('splits parenthetical vPIC names into separate candidates', () => {
    const candidates = buildCandidateModels('Honda', 'VT750 (Shadow Aero 750)', []);
    expect(candidates).toContain('VT750');
    expect(candidates).toContain('Shadow Aero 750');
  });

  it('adds curated aliases for marketing names with unrelated codes', () => {
    const candidates = buildCandidateModels('Honda', 'Gold Wing', []);
    expect(candidates).toEqual(['Gold Wing', 'GL1800']);
  });

  it('alias keys are case- and whitespace-insensitive', () => {
    const candidates = buildCandidateModels('HONDA', 'africa  twin', []);
    expect(candidates).toContain('CRF1100L');
    expect(candidates).toContain('CRF1000');
  });

  it('adds recall-side names matched by name or by alias', () => {
    const candidates = buildCandidateModels('Honda', 'Africa Twin', [
      'CRF1100 AFRICA TWIN', // matches stored name
      'CRF1100A', // matches the CRF1100 alias by containment
      'GL1800', // unrelated — must not appear
    ]);
    expect(candidates).toContain('CRF1100 AFRICA TWIN');
    expect(candidates).toContain('CRF1100A');
    expect(candidates).not.toContain('GL1800');
  });

  it('dedupes candidates that only differ in spacing or case', () => {
    const candidates = buildCandidateModels('BMW', 'R 1250 GS', ['R1250GS']);
    expect(candidates).toEqual(['R 1250 GS']);
  });

  it('caps the candidate list', () => {
    const recallSide = Array.from({ length: 20 }, (_, i) => `AFRICA TWIN ${i}${i}${i}`);
    const candidates = buildCandidateModels('Honda', 'Africa Twin', recallSide);
    expect(candidates.length).toBeLessThanOrEqual(8);
  });
});
