import { describe, expect, it, vi } from 'vitest';
import robots from '../robots';

vi.mock('@/lib/constants', () => ({ BASE_URL: 'https://motovault.app' }));

// Googlebot needs the CSS, JS and optimized images under /_next/ to render pages.
const RENDER_ASSETS = ['/_next/static/chunks/app.css', '/_next/image?url=%2Fhero.webp&w=640&q=75'];

/** robots.txt prefix match, with `*` as a wildcard (Google's syntax). */
function matches(rule: string, path: string): boolean {
  const pattern = rule.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${pattern}`).test(path);
}

describe('robots.txt', () => {
  const { rules } = robots();
  const everyone = (Array.isArray(rules) ? rules : [rules]).find((r) => r.userAgent === '*');
  const disallow = [everyone?.disallow ?? []].flat();

  it.each(RENDER_ASSETS)('lets crawlers fetch %s', (path) => {
    expect(disallow.filter((rule) => matches(rule, path))).toEqual([]);
  });

  it('still keeps the API and auth pages out', () => {
    expect(disallow).toEqual(expect.arrayContaining(['/api/*', '/login', '/signup']));
  });
});
