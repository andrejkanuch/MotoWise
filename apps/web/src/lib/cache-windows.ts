/**
 * The ISR window for DB- and repo-sourced static pages and every cache they
 * read (30 days; edits are pushed through `/api/revalidate`). A route
 * regenerates at the lowest `revalidate` it reads, so one shorter cache on these
 * pages silently caps the whole route and brings the ISR writes back.
 *
 * Next.js needs a route segment's `export const revalidate` to be a literal, so
 * those pages repeat the number; `cache-windows.test.ts` keeps them equal.
 */
export const LONG_REVALIDATE_SECONDS = 2592000;
