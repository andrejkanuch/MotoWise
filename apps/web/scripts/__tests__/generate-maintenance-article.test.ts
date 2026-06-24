import type { MaintenanceNarrative } from '@motovault/types';
import { describe, expect, it } from 'vitest';
import { buildBody, buildFaq } from '../generate-maintenance-article';

const narrative: MaintenanceNarrative = {
  intro: 'The Africa Twin DCT is built for adventure.',
  diyVsDealer: 'Some tasks suit DIY; complex systems suit the dealer.',
  ownershipNotes: 'Keep it clean and inspected.',
  sections: [{ heading: 'Storage', body: 'Store it dry.' }],
  keyTakeaways: ['Follow the schedule.', 'Use the right fluids.'],
};

const TABLES = '### Service intervals\n\n| a | b |\n|---|---|';

describe('buildBody', () => {
  it('builds a full body on first generation (no existing)', () => {
    const out = buildBody(narrative, TABLES, null);
    expect(out).toContain(narrative.intro);
    expect(out).toContain('## Maintenance Schedule & Specifications');
    expect(out).toContain('{/* SPEC_TABLES_START */}');
    expect(out).toContain('{/* SPEC_TABLES_END */}');
    expect(out).toContain('Service intervals');
  });

  it('surgically replaces ONLY the table region, preserving the stored narrative', () => {
    const existing = [
      'CUSTOM hand-edited narrative that must survive.',
      '',
      '{/* SPEC_TABLES_START */}',
      '',
      'OLD TABLE CONTENT',
      '',
      '{/* SPEC_TABLES_END */}',
    ].join('\n');
    const out = buildBody(narrative, TABLES, existing);
    expect(out).toContain('CUSTOM hand-edited narrative that must survive.');
    expect(out).not.toContain('OLD TABLE CONTENT');
    expect(out).toContain('Service intervals');
    // The narrative was NOT rebuilt from the input narrative on surgical re-gen.
    expect(out).not.toContain(narrative.intro);
  });
});

describe('buildFaq', () => {
  it('maps key takeaways to question/answer pairs', () => {
    const faq = buildFaq(narrative);
    expect(faq).toHaveLength(2);
    expect(faq[0].answer).toBe('Follow the schedule.');
    expect(faq[0].question).toMatch(/Africa Twin/);
  });
});
