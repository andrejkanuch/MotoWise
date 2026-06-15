import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards against broken internal /blog/ links — they render a 200 "Article Not
 * Found" page (a soft 404 in GSC) and leak internal link equity. Every
 * `[text](/blog/slug)` link in English MDX must resolve to an existing post.
 * Linking to a redirected/deleted slug also fails here, forcing direct links.
 */
describe('blog internal links', () => {
  const dir = path.join(process.cwd(), 'content/blog/en');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'));
  const slugs = new Set(files.map((f) => f.replace('.mdx', '')));
  const linkRe = /\]\((\/blog\/[a-z0-9-]+)\)/g;

  it.each(files)('%s has no broken internal /blog/ links', (file) => {
    const txt = fs.readFileSync(path.join(dir, file), 'utf-8');
    const broken = [...txt.matchAll(linkRe)]
      .map((m) => m[1])
      .filter((href) => !slugs.has(href.replace('/blog/', '')));
    expect(broken, `broken links in ${file}: ${broken.join(', ')}`).toEqual([]);
  });
});
