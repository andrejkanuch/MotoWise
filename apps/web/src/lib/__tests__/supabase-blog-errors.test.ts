import { beforeEach, describe, expect, it, vi } from 'vitest';

// A query error must reject, never resolve to `null` / `[]`: unstable_cache
// stores a resolved value for the whole revalidate window (30 days), so an
// empty answer from a transient Supabase failure would ship a blank post or
// list. A rejection is not cached and ISR keeps the last good page.

const queryError = { message: 'connection reset', code: '08006' };

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => {
    const builder: Record<string, unknown> = {};
    for (const method of ['from', 'select', 'eq', 'order']) {
      builder[method] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: queryError }));
    // biome-ignore lint/suspicious/noThenProperty: mocking PostgREST's thenable builder
    builder.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: null, error: queryError }).then(resolve);
    return builder;
  },
}));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon');
});

const blog = await import('../supabase-blog');

describe('blog reads reject on a Supabase error instead of caching an empty value', () => {
  it.each([
    ['listPublishedArticles', () => blog.listPublishedArticles('en')],
    ['listPublishedArticlesForArticlePages', () => blog.listPublishedArticlesForArticlePages('en')],
    ['fetchArticleBody', () => blog.fetchArticleBody('oil', 'en')],
    ['listBlogCategories', () => blog.listBlogCategories()],
    ['listTranslatedLocales', () => blog.listTranslatedLocales('oil')],
  ])('%s', async (_name, read) => {
    await expect(read()).rejects.toThrow('connection reset');
  });
});
