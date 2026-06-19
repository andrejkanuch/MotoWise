/**
 * Cache tags for DB-sourced content. Re-exported from `@motovault/types` so the
 * web app and the API share one definition (the API sends these to
 * `POST /api/revalidate`). Import sites stay on `@/lib/seo/cache-tags`.
 */
export { CACHE_TAGS, type CacheTag } from '@motovault/types';
