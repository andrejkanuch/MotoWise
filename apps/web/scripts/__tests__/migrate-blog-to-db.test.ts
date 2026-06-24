import { describe, expect, it } from 'vitest';
import {
  baseDoc,
  detectType,
  groupBySlug,
  type ParsedDoc,
  slugify,
  stripMdxToText,
  toPostRow,
  toTranslationRow,
} from '../migrate-blog-to-db';

describe('slugify', () => {
  it('kebab-cases a label', () => {
    expect(slugify('DIY Guide')).toBe('diy-guide');
  });
  it('strips punctuation and edge dashes', () => {
    expect(slugify('  Brand-Guide!! ')).toBe('brand-guide');
  });
});

describe('stripMdxToText', () => {
  it('removes JSX tags, comments, code fences and table syntax', () => {
    const body = [
      '## Heading',
      '',
      'Some **bold** text with a [link](https://x.com).',
      '<!-- SPEC_TABLES_START -->',
      '| a | b |',
      '<Callout>hi</Callout>',
      '```js',
      'const x = 1;',
      '```',
    ].join('\n');
    const out = stripMdxToText(body);
    expect(out).not.toMatch(/<|>|```|SPEC_TABLES|\|/);
    expect(out).toContain('Heading');
    expect(out).toContain('bold');
    expect(out).toContain('link'); // link text retained, URL dropped
    expect(out).not.toContain('https://x.com');
  });
});

describe('detectType', () => {
  it('flags dataset_models posts as maintenance', () => {
    expect(detectType({ dataset_models: ['HONDA/CRF1100/DCT'] })).toBe('maintenance');
  });
  it('defaults to guide', () => {
    expect(detectType({ specData: true, category: 'brand-guide' })).toBe('guide');
  });
});

describe('toPostRow', () => {
  it('maps frontmatter to a published base row', () => {
    const row = toPostRow('kawasaki-ninja', {
      title: 'Ninja',
      date: '2026-03-16',
      author: 'A. Kanuch',
      heroImage: '/images/blog/x.webp',
      specData: true,
    });
    expect(row.type).toBe('guide');
    expect(row.status).toBe('published');
    expect(row.spec_data).toBe(true);
    expect(row.cover_image).toBe('/images/blog/x.webp');
    expect(row.published_at).toContain('2026-03-16');
  });
});

describe('toTranslationRow', () => {
  it('filters invalid faq entries and folds keywords into keyword_text', () => {
    const row = toTranslationRow('post-1', 'en', {
      title: 'T',
      excerpt: 'E',
      keywords: ['oil change', 'valve'],
      readingTime: '8',
      faq: [
        { question: 'Q', answer: 'A' },
        // biome-ignore lint: intentionally malformed for the filter test
        { question: '', answer: 'x' } as { question: string; answer: string },
      ],
    }, '# Body\n\nHello world.');
    expect(row.keyword_text).toBe('oil change valve');
    expect(row.faq).toHaveLength(1);
    expect(row.seo_title).toBe('T');
    expect(row.word_count).toBeGreaterThan(0);
  });
});

describe('groupBySlug / baseDoc', () => {
  const docs: ParsedDoc[] = [
    { slug: 'a', locale: 'de', frontmatter: { title: 'A-de' }, body: '' },
    { slug: 'a', locale: 'en', frontmatter: { title: 'A-en' }, body: '' },
    { slug: 'b', locale: 'es', frontmatter: { title: 'B-es' }, body: '' },
  ];
  it('groups by slug', () => {
    const groups = groupBySlug(docs);
    expect(groups.get('a')).toHaveLength(2);
    expect(groups.get('b')).toHaveLength(1);
  });
  it('prefers the en doc as the base, else first', () => {
    const groups = groupBySlug(docs);
    expect(baseDoc(groups.get('a') ?? []).frontmatter.title).toBe('A-en');
    expect(baseDoc(groups.get('b') ?? []).frontmatter.title).toBe('B-es');
  });
});
