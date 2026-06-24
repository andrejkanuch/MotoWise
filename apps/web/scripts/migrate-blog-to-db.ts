/**
 * One-time importer: file-based MDX blog -> Postgres blog CMS (plan U3).
 *
 * Reads every content/blog/{locale}/*.mdx, groups files by slug across locales,
 * and upserts blog_posts + per-type row + translations + taxonomy. Idempotent
 * (upsert on natural keys) so it can be re-run safely. Service-role client — this
 * is a one-off admin job, not a request path.
 *
 * Run: pnpm --filter web tsx scripts/migrate-blog-to-db.ts
 * (requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in the shell)
 *
 * The numbers (intervals/specs) for maintenance posts are NOT re-derived here;
 * the body MDX is imported verbatim. The maintenance generator (U10) owns the
 * dataset-driven table region going forward.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BLOG_LOCALES, BlogPostType, stripMdxToText } from '@motovault/types';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import matter from 'gray-matter';

// Re-exported so the generator (U10) and tests keep importing it from here.
export { stripMdxToText };

// --- Frontmatter shape (mirrors apps/web/src/lib/blog.ts Article fields) ------
interface BlogFrontmatter {
  slug?: string;
  title?: string;
  excerpt?: string;
  keywords?: string[];
  author?: string;
  date?: string;
  dateModified?: string;
  readingTime?: string;
  locale?: string;
  heroImage?: string;
  heroAlt?: string;
  category?: string;
  specData?: boolean;
  dataset_models?: string[];
  faq?: Array<{ question: string; answer: string }>;
}

export interface ParsedDoc {
  slug: string;
  locale: string;
  frontmatter: BlogFrontmatter;
  body: string;
}

const CONTENT_DIR = join(process.cwd(), 'content', 'blog');

// --- Pure helpers (unit-tested) ----------------------------------------------

/** kebab-case a free-text label into a taxonomy slug. */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Dataset-driven maintenance posts carry `dataset_models`; everything else is a guide. */
export function detectType(fm: BlogFrontmatter): string {
  return Array.isArray(fm.dataset_models) && fm.dataset_models.length > 0
    ? BlogPostType.MAINTENANCE
    : BlogPostType.GUIDE;
}

/** Build the base blog_posts row from a post's (en-preferred) frontmatter. */
export function toPostRow(slug: string, fm: BlogFrontmatter) {
  return {
    type: detectType(fm),
    slug,
    status: 'published' as const, // imported posts are already live
    published_at: fm.date ? new Date(fm.date).toISOString() : null,
    author: fm.author ?? null,
    cover_image: fm.heroImage ?? null,
    cover_alt: fm.heroAlt ?? null,
    spec_data: fm.specData === true,
    is_safety_critical: false,
  };
}

/** Build a translation row for one locale of a post. */
export function toTranslationRow(
  postId: string,
  locale: string,
  fm: BlogFrontmatter,
  body: string,
) {
  const faq = Array.isArray(fm.faq)
    ? fm.faq.filter(
        (f) =>
          typeof f?.question === 'string' &&
          typeof f?.answer === 'string' &&
          f.question.trim() !== '' &&
          f.answer.trim() !== '',
      )
    : [];
  const bodyText = stripMdxToText(body);
  return {
    post_id: postId,
    locale,
    title: fm.title ?? '',
    excerpt: fm.excerpt ?? null,
    seo_title: fm.title ?? null,
    seo_description: fm.excerpt ?? null,
    body_raw: body,
    body_text: bodyText,
    keyword_text: Array.isArray(fm.keywords) ? fm.keywords.join(' ') : '',
    faq,
    reading_time: fm.readingTime ?? null,
    word_count: bodyText ? bodyText.split(/\s+/).length : 0,
  };
}

// --- Disk read ----------------------------------------------------------------

export function readAllDocs(): ParsedDoc[] {
  const docs: ParsedDoc[] = [];
  for (const locale of BLOG_LOCALES) {
    const dir = join(CONTENT_DIR, locale);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.mdx'))) {
      const raw = readFileSync(join(dir, file), 'utf-8');
      const { data, content } = matter(raw);
      const fm = data as BlogFrontmatter;
      docs.push({
        slug: fm.slug || file.replace(/\.mdx$/, ''),
        locale,
        frontmatter: fm,
        body: content,
      });
    }
  }
  return docs;
}

/** Group parsed docs by slug; en (or first) frontmatter is the post-level source. */
export function groupBySlug(docs: ParsedDoc[]): Map<string, ParsedDoc[]> {
  const groups = new Map<string, ParsedDoc[]>();
  for (const doc of docs) {
    const list = groups.get(doc.slug) ?? [];
    list.push(doc);
    groups.set(doc.slug, list);
  }
  return groups;
}

/** From a slug's locale docs, pick the one whose frontmatter drives post-level fields. */
export function baseDoc(group: ParsedDoc[]): ParsedDoc {
  return group.find((d) => d.locale === 'en') ?? group[0];
}

// --- Supabase (service role) --------------------------------------------------

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (server-only).');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function upsertCategory(db: SupabaseClient, name: string): Promise<string> {
  const slug = slugify(name);
  const { data, error } = await db
    .from('categories')
    .upsert({ slug, name }, { onConflict: 'slug' })
    .select('id')
    .single();
  if (error) throw new Error(`category upsert failed (${slug}): ${error.message}`);
  return (data as { id: string }).id;
}

async function upsertKeyword(db: SupabaseClient, name: string): Promise<string> {
  const slug = slugify(name);
  const { data, error } = await db
    .from('keywords')
    .upsert({ slug, name }, { onConflict: 'slug' })
    .select('id')
    .single();
  if (error) throw new Error(`keyword upsert failed (${slug}): ${error.message}`);
  return (data as { id: string }).id;
}

async function importPost(db: SupabaseClient, slug: string, group: ParsedDoc[]): Promise<void> {
  const base = baseDoc(group);
  const fm = base.frontmatter;

  // 1) base row
  const { data: post, error: postErr } = await db
    .from('blog_posts')
    .upsert(toPostRow(slug, fm), { onConflict: 'slug' })
    .select('id, type')
    .single();
  if (postErr) throw new Error(`blog_posts upsert failed (${slug}): ${postErr.message}`);
  const postId = (post as { id: string }).id;
  const type = (post as { type: string }).type;

  // 2) per-type row
  if (type === BlogPostType.MAINTENANCE) {
    const { error } = await db
      .from('blog_post_maintenance')
      .upsert(
        { post_id: postId, dataset_models: fm.dataset_models ?? [] },
        { onConflict: 'post_id' },
      );
    if (error) throw new Error(`maintenance row failed (${slug}): ${error.message}`);
  } else {
    const { error } = await db
      .from('blog_post_guide')
      .upsert({ post_id: postId }, { onConflict: 'post_id' });
    if (error) throw new Error(`guide row failed (${slug}): ${error.message}`);
  }

  // 3) translations (one per locale present)
  for (const doc of group) {
    const { error } = await db
      .from('blog_post_translations')
      .upsert(toTranslationRow(postId, doc.locale, doc.frontmatter, doc.body), {
        onConflict: 'post_id,locale',
      });
    if (error) throw new Error(`translation failed (${slug}/${doc.locale}): ${error.message}`);
  }

  // 4) category (single, primary) — from the base frontmatter
  if (fm.category) {
    const categoryId = await upsertCategory(db, fm.category);
    const { error } = await db.from('blog_post_categories').upsert(
      { post_id: postId, category_id: categoryId, is_primary: true },
      {
        onConflict: 'post_id,category_id',
      },
    );
    if (error) throw new Error(`post-category link failed (${slug}): ${error.message}`);
  }

  // 5) keywords (many) — the join trigger refreshes keyword_text on translations
  for (const kw of fm.keywords ?? []) {
    const keywordId = await upsertKeyword(db, kw);
    const { error } = await db
      .from('blog_post_keywords')
      .upsert({ post_id: postId, keyword_id: keywordId }, { onConflict: 'post_id,keyword_id' });
    if (error) throw new Error(`post-keyword link failed (${slug}/${kw}): ${error.message}`);
  }
}

async function main(): Promise<void> {
  const docs = readAllDocs();
  const groups = groupBySlug(docs);
  const db = getServiceClient();

  let posts = 0;
  let translations = 0;
  for (const [slug, group] of groups) {
    await importPost(db, slug, group);
    posts += 1;
    translations += group.length;
    console.log(`[blog-import] ${slug} (${group.map((g) => g.locale).join(',')})`);
  }
  console.log(`[blog-import] done: ${posts} posts, ${translations} translations`);
}

// Only run when invoked directly (not when imported by tests).
if (process.argv[1]?.endsWith('migrate-blog-to-db.ts')) {
  main().catch((err: unknown) => {
    console.error('[blog-import] failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
