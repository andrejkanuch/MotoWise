import { describe, expect, it } from 'vitest';
import { stripHtmlComments } from '../blog-mdx';

describe('stripHtmlComments', () => {
  it('removes a bare HTML comment', () => {
    expect(stripHtmlComments('before <!-- note --> after')).toBe('before  after');
  });

  it('removes multiple separate comments without merging the text between them', () => {
    expect(stripHtmlComments('a <!-- one --> b <!-- two --> c')).toBe('a  b  c');
  });

  it('removes multiline comments', () => {
    expect(stripHtmlComments('a\n<!--\nline1\nline2\n-->\nb')).toBe('a\n\nb');
  });

  it('is non-greedy — content between two comments survives', () => {
    expect(stripHtmlComments('<!-- x --> keep <!-- y -->')).toBe(' keep ');
  });

  it('leaves an unterminated comment alone (handled by the compileMDX try/catch)', () => {
    expect(stripHtmlComments('text <!-- dangling')).toBe('text <!-- dangling');
  });

  it('leaves ordinary markdown and MDX untouched', () => {
    const source = '# Title\n\nSome **bold** text with <Component prop="x" /> and `code`.';
    expect(stripHtmlComments(source)).toBe(source);
  });

  it('documents the code-fence tradeoff: comments inside fenced blocks are also stripped', () => {
    const source = '```html\n<!-- example -->\n```';
    expect(stripHtmlComments(source)).toBe('```html\n\n```');
  });
});
