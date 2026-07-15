import { describe, expect, it } from 'vitest';
import { CtaAngle, extractMakeModel, extractModel, resolveCtaAngle } from '../blog-cta';

describe('resolveCtaAngle', () => {
  it('routes cost-intent articles to the expense angle regardless of type', () => {
    expect(
      resolveCtaAngle({ type: 'maintenance', slug: 'motorcycle-maintenance-cost-per-year' }),
    ).toBe(CtaAngle.Cost);
    expect(
      resolveCtaAngle({ type: 'guide', slug: 'how-much-does-a-motorcycle-cost', keywords: [] }),
    ).toBe(CtaAngle.Cost);
  });

  it('detects cost intent from keywords, not just the slug', () => {
    expect(
      resolveCtaAngle({ type: 'guide', slug: 'owning-a-bike', keywords: ['running costs'] }),
    ).toBe(CtaAngle.Cost);
  });

  it('maps maintenance articles to the maintenance angle', () => {
    expect(
      resolveCtaAngle({ type: 'maintenance', slug: 'yamaha-mt-07-maintenance-schedule' }),
    ).toBe(CtaAngle.Maintenance);
  });

  it('maps guides and everything else to the service-history angle', () => {
    expect(resolveCtaAngle({ type: 'guide', slug: 'check-engine-light' })).toBe(CtaAngle.Guide);
    expect(resolveCtaAngle({ type: 'trip', slug: 'alps-loop' })).toBe(CtaAngle.Guide);
    expect(resolveCtaAngle({ type: 'gear', slug: 'best-helmets' })).toBe(CtaAngle.Guide);
    expect(resolveCtaAngle({ type: 'unknown-type', slug: 'x' })).toBe(CtaAngle.Guide);
  });
});

describe('extractModel', () => {
  it('extracts brand + model from a title', () => {
    expect(extractModel('Yamaha MT-07 Maintenance Schedule (2021–2024)')).toBe('Yamaha MT-07');
    expect(extractModel('Honda CBR600RR Oil Change Guide')).toBe('Honda CBR600RR');
  });

  it('matches multi-word brands before shorter ones', () => {
    expect(extractModel('Harley-Davidson Sportster Service Intervals')).toBe(
      'Harley-Davidson Sportster',
    );
    expect(extractModel('Royal Enfield Himalayan Review')).toBe('Royal Enfield Himalayan');
  });

  it('returns null when no brand leads the title', () => {
    expect(extractModel('How Much Does It Cost to Own a Motorcycle?')).toBeNull();
    expect(extractModel('Motorcycle Check Engine Light Guide')).toBeNull();
  });
});

describe('extractMakeModel', () => {
  it('splits make from model for the Play install referrer', () => {
    expect(extractMakeModel('Yamaha MT-07 Maintenance Schedule')).toEqual({
      make: 'Yamaha',
      model: 'MT-07',
    });
    expect(extractMakeModel('Harley-Davidson Sportster Service Intervals')).toEqual({
      make: 'Harley-Davidson',
      model: 'Sportster',
    });
  });

  it('returns an empty model when only the brand leads the title', () => {
    expect(extractMakeModel('Honda Maintenance Guide')).toEqual({ make: 'Honda', model: '' });
  });

  it('returns null when no brand leads the title', () => {
    expect(extractMakeModel('How Much Does a Motorcycle Cost?')).toBeNull();
  });
});
