'use client';

import type {
  AdminBlogPostQuery,
  BlogTaxonomyQuery,
  BlogTranslationInput,
} from '@motovault/graphql';
import {
  AdminBlogPostVersionsDocument,
  BlogTaxonomyDocument,
  CreateBlogCategoryDocument,
  CreateBlogKeywordDocument,
  CreateBlogPostDocument,
  DeleteBlogPostDocument,
  PublishBlogPostDocument,
  RevertBlogPostVersionDocument,
  ScheduleBlogPostDocument,
  UnpublishBlogPostDocument,
  UpdateBlogPostDocument,
} from '@motovault/graphql';
import {
  BLOG_LOCALES,
  BlogGuideDifficulty,
  type BlogLocale,
  BlogPostStatus,
  BlogPostType,
} from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';
import { ADMIN_BLOG_LIST_KEY } from './blog-status';
import { MarkdownEditor } from './markdown-editor';

type Post = NonNullable<AdminBlogPostQuery['adminBlogPost']>;

// ─── Per-type field config (data-driven; adding a type = one entry) ───
type FieldKind = 'text' | 'number' | 'list' | 'select';
type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  placeholder?: string;
};

const TYPE_FIELDS: Record<string, readonly FieldDef[]> = {
  [BlogPostType.GUIDE]: [
    {
      key: 'difficulty',
      label: 'Difficulty',
      kind: 'select',
      options: Object.values(BlogGuideDifficulty),
    },
  ],
  [BlogPostType.MAINTENANCE]: [
    { key: 'make', label: 'Make', kind: 'text', placeholder: 'Honda' },
    { key: 'model', label: 'Model', kind: 'text', placeholder: 'Africa Twin' },
    { key: 'variant', label: 'Variant', kind: 'text', placeholder: 'DCT' },
    { key: 'datasetModels', label: 'Dataset models', kind: 'list', placeholder: 'comma-separated' },
    {
      key: 'applicableModels',
      label: 'Applicable models',
      kind: 'list',
      placeholder: 'comma-separated',
    },
  ],
  [BlogPostType.TRIP]: [
    { key: 'distanceKm', label: 'Distance (km)', kind: 'number' },
    { key: 'countryCodes', label: 'Country codes', kind: 'list', placeholder: 'ES, FR, IT' },
    { key: 'routeGpx', label: 'Route GPX (URL/path)', kind: 'text' },
  ],
  [BlogPostType.GEAR]: [
    { key: 'brand', label: 'Brand', kind: 'text' },
    { key: 'model', label: 'Model', kind: 'text' },
    { key: 'rating', label: 'Rating (0–5)', kind: 'number' },
    { key: 'priceEur', label: 'Price (EUR)', kind: 'number' },
    { key: 'verdict', label: 'Verdict', kind: 'text' },
  ],
};

// ─── Conversion helpers (flat string fields ⇄ typed typeData) ───
const splitList = (v: string | undefined): string[] =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const numOrNull = (v: string | undefined): number | null => {
  if (!v || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const strOrNull = (v: string | undefined): string | null =>
  v && v.trim() !== '' ? v.trim() : null;

/** Build the typed typeData payload from the flat string fields, by post type. */
function buildTypeData(type: string, f: Record<string, string>): Record<string, unknown> {
  const meta = {};
  switch (type) {
    case BlogPostType.MAINTENANCE:
      return {
        type,
        make: strOrNull(f.make),
        model: strOrNull(f.model),
        variant: strOrNull(f.variant),
        datasetModels: splitList(f.datasetModels),
        applicableModels: splitList(f.applicableModels),
        meta,
      };
    case BlogPostType.TRIP:
      return {
        type,
        distanceKm: numOrNull(f.distanceKm),
        countryCodes: splitList(f.countryCodes),
        routeGpx: strOrNull(f.routeGpx),
        meta,
      };
    case BlogPostType.GEAR:
      return {
        type,
        brand: strOrNull(f.brand),
        model: strOrNull(f.model),
        rating: numOrNull(f.rating),
        priceEur: numOrNull(f.priceEur),
        verdict: strOrNull(f.verdict),
        meta,
      };
    default: // guide
      return { type, difficulty: strOrNull(f.difficulty), meta };
  }
}

/** Reverse: hydrate the flat string fields from an existing post's typeData. */
function typeDataToFields(
  typeData: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const td = typeData ?? {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(td)) {
    if (k === 'type' || k === 'meta') continue;
    out[k] = Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v);
  }
  return out;
}

// ─── Translation editor state ───
type FaqItem = { question: string; answer: string };
type TranslationState = {
  title: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  bodyRaw: string;
  readingTime: string;
  faq: FaqItem[];
};

const emptyTranslation = (): TranslationState => ({
  title: '',
  excerpt: '',
  seoTitle: '',
  seoDescription: '',
  bodyRaw: '',
  readingTime: '',
  faq: [],
});

function postToTranslations(post: Post | null): Record<string, TranslationState> {
  const map: Record<string, TranslationState> = {};
  for (const t of post?.translations ?? []) {
    const faqRaw = Array.isArray(t.faq) ? (t.faq as FaqItem[]) : [];
    map[t.locale] = {
      title: t.title ?? '',
      excerpt: t.excerpt ?? '',
      seoTitle: t.seoTitle ?? '',
      seoDescription: t.seoDescription ?? '',
      bodyRaw: t.bodyRaw ?? '',
      readingTime: t.readingTime ?? '',
      faq: faqRaw.map((q) => ({ question: q.question ?? '', answer: q.answer ?? '' })),
    };
  }
  return map;
}

/** A locale tab is "complete" enough to publish when it has a title + body. */
const isTranslationComplete = (t: TranslationState | undefined): boolean =>
  Boolean(t?.title.trim() && t?.bodyRaw.trim());

// ─── datetime-local ⇄ UTC ISO ───
/** Value of a <input type=datetime-local> (local wall-clock) → UTC ISO string. */
function localInputToUtcIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local); // interpreted as local time
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-600 border-t-neutral-200 align-[-2px]"
      aria-hidden="true"
    />
  );
}

export function BlogEditor({ post }: { post?: Post | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Base fields
  const [type, setType] = useState<string>(post?.type ?? BlogPostType.GUIDE);
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [author, setAuthor] = useState(post?.author ?? '');
  const [coverImage, setCoverImage] = useState(post?.coverImage ?? '');
  const [coverAlt, setCoverAlt] = useState(post?.coverAlt ?? '');
  const [specData, setSpecData] = useState(post?.specData ?? false);
  const [isSafetyCritical, setIsSafetyCritical] = useState(post?.isSafetyCritical ?? false);

  // Per-type fields (flat strings)
  const [typeFields, setTypeFields] = useState<Record<string, string>>(
    typeDataToFields(post?.typeData),
  );

  // Translations
  const [translations, setTranslations] = useState<Record<string, TranslationState>>(() => {
    const initial = postToTranslations(post ?? null);
    if (!initial.en) initial.en = emptyTranslation();
    return initial;
  });
  const [activeLocale, setActiveLocale] = useState<BlogLocale>('en');

  // Taxonomy selections
  const [categoryIds, setCategoryIds] = useState<string[]>(
    (post?.categories ?? []).map((c) => c.id),
  );
  const [keywordIds, setKeywordIds] = useState<string[]>((post?.keywords ?? []).map((k) => k.id));

  // Scheduling
  const [scheduleAt, setScheduleAt] = useState('');

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  const taxonomyQuery = useQuery({
    queryKey: ['admin', 'blog-taxonomy'],
    queryFn: () => gqlFetcher(BlogTaxonomyDocument),
  });

  const status = post?.status ?? BlogPostStatus.DRAFT;

  // ── Translation field setter ──
  const setTr = useCallback((locale: string, patch: Partial<TranslationState>) => {
    setTranslations((prev) => ({
      ...prev,
      [locale]: { ...(prev[locale] ?? emptyTranslation()), ...patch },
    }));
  }, []);

  const active = translations[activeLocale] ?? emptyTranslation();

  // ── Build the GraphQL input payloads ──
  const buildTranslationsInput = useCallback((): BlogTranslationInput[] => {
    // Only send locales the author actually touched (title present).
    return Object.entries(translations)
      .filter(([, t]) => t.title.trim() || t.bodyRaw.trim())
      .map(([locale, t]) => ({
        locale,
        title: t.title.trim(),
        excerpt: strOrNull(t.excerpt) ?? undefined,
        seoTitle: strOrNull(t.seoTitle) ?? undefined,
        seoDescription: strOrNull(t.seoDescription) ?? undefined,
        bodyRaw: t.bodyRaw,
        readingTime: strOrNull(t.readingTime) ?? undefined,
        // faq is stored as a JSON array; the JSON scalar type can't express that, so cast here.
        faq: t.faq.filter(
          (q) => q.question.trim() && q.answer.trim(),
        ) as unknown as BlogTranslationInput['faq'],
      }));
  }, [translations]);

  const run = useCallback(
    async (action: string, fn: () => Promise<unknown>, opts?: { invalidate?: boolean }) => {
      setPendingAction(action);
      setError(null);
      try {
        await fn();
        if (opts?.invalidate !== false) {
          await queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_LIST_KEY });
          if (post) {
            await queryClient.invalidateQueries({ queryKey: ['admin', 'blog-post', post.id] });
          }
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        return false;
      } finally {
        setPendingAction((cur) => (cur === action ? null : cur));
      }
    },
    [queryClient, post],
  );

  // ── Create ──
  const handleCreate = async () => {
    const trs = buildTranslationsInput();
    if (trs.length === 0) {
      setError('Add a title and body for at least one locale before saving.');
      return;
    }
    const ok = await run(
      'create',
      async () => {
        const res = await gqlFetcher(CreateBlogPostDocument, {
          input: {
            type,
            slug: slug.trim(),
            status: BlogPostStatus.DRAFT,
            author: strOrNull(author) ?? undefined,
            coverImage: strOrNull(coverImage) ?? undefined,
            coverAlt: strOrNull(coverAlt) ?? undefined,
            specData,
            isSafetyCritical,
            typeData: buildTypeData(type, typeFields),
            translations: trs,
            categoryIds,
            keywordIds,
          },
        });
        return res.createBlogPost.id;
      },
      { invalidate: true },
    );
    if (ok) {
      await queryClient.invalidateQueries({ queryKey: ADMIN_BLOG_LIST_KEY });
      router.push('/admin/blog');
    }
  };

  // ── Save (edit) ──
  const handleSave = async () => {
    if (!post) return;
    await run('save', async () => {
      await gqlFetcher(UpdateBlogPostDocument, {
        input: {
          id: post.id,
          author: strOrNull(author) ?? undefined,
          coverImage: strOrNull(coverImage) ?? undefined,
          coverAlt: strOrNull(coverAlt) ?? undefined,
          specData,
          isSafetyCritical,
          typeData: buildTypeData(type, typeFields),
          translations: buildTranslationsInput(),
          categoryIds,
          keywordIds,
        },
      });
    });
  };

  const handlePublish = async () => {
    if (!post) return;
    await handleSave();
    await run('publish', () => gqlFetcher(PublishBlogPostDocument, { id: post.id }));
    router.refresh();
  };

  const handleSchedule = async () => {
    if (!post) return;
    const iso = localInputToUtcIso(scheduleAt);
    if (!iso) {
      setError('Pick a valid date & time to schedule.');
      return;
    }
    await handleSave();
    await run('schedule', () =>
      gqlFetcher(ScheduleBlogPostDocument, { input: { id: post.id, scheduledFor: iso } }),
    );
    router.refresh();
  };

  const handleUnpublish = async () => {
    if (!post) return;
    await run('unpublish', () => gqlFetcher(UnpublishBlogPostDocument, { id: post.id }));
    router.refresh();
  };

  const handleDelete = async () => {
    if (!post) return;
    if (!confirm('Delete this post and all its translations? This cannot be undone.')) return;
    const ok = await run('delete', () => gqlFetcher(DeleteBlogPostDocument, { id: post.id }));
    if (ok) router.push('/admin/blog');
  };

  const busy = pendingAction !== null;

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-50">{post ? 'Edit post' : 'New post'}</h1>
          {post && (
            <p className="mt-1 text-sm text-neutral-400">
              <span className="font-mono">{post.slug}</span> · {post.type} ·{' '}
              <span className="capitalize">{status}</span>
            </p>
          )}
        </div>
        {post && (
          <button
            type="button"
            onClick={() => setShowVersions(true)}
            className="px-3 py-2 rounded-lg border border-neutral-700 text-neutral-200 text-sm hover:bg-neutral-800 transition-colors"
          >
            Version history
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg border border-red-900 bg-red-950/40 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Base fields ── */}
      <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Type">
          <select
            value={type}
            disabled={!!post}
            onChange={(e) => {
              setType(e.target.value);
              setTypeFields({}); // nothing persisted yet in create mode
            }}
            className={selectClass}
          >
            {Object.values(BlogPostType).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {post && <Hint>Type is fixed after creation.</Hint>}
        </Field>

        <Field label="Slug">
          <input
            type="text"
            value={slug}
            disabled={!!post}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="oil-change-guide"
            className={inputClass}
          />
          {post && <Hint>Slug is fixed after creation.</Hint>}
        </Field>

        <Field label="Author">
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Cover image (URL or /images/...)">
          <input
            type="text"
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder="/images/blog/cover.webp"
            className={inputClass}
          />
        </Field>
        <Field label="Cover alt text">
          <input
            type="text"
            value={coverAlt}
            onChange={(e) => setCoverAlt(e.target.value)}
            className={inputClass}
          />
        </Field>
        <div className="flex items-end gap-6">
          <Checkbox checked={specData} onChange={setSpecData} label="Spec data disclaimer" />
          <Checkbox
            checked={isSafetyCritical}
            onChange={setIsSafetyCritical}
            label="Safety-critical"
          />
        </div>
      </section>

      {/* ── Type-specific fields ── */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-300 mb-3 uppercase tracking-wide">
          {type} fields
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(TYPE_FIELDS[type] ?? []).map((f) => (
            <Field key={f.key} label={f.label}>
              {f.kind === 'select' ? (
                <select
                  value={typeFields[f.key] ?? ''}
                  onChange={(e) => setTypeFields((p) => ({ ...p, [f.key]: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.kind === 'number' ? 'number' : 'text'}
                  value={typeFields[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setTypeFields((p) => ({ ...p, [f.key]: e.target.value }))}
                  className={inputClass}
                />
              )}
            </Field>
          ))}
        </div>
      </section>

      {/* ── Taxonomy ── */}
      <TaxonomyPicker
        taxonomy={taxonomyQuery.data}
        categoryIds={categoryIds}
        keywordIds={keywordIds}
        onCategoryIds={setCategoryIds}
        onKeywordIds={setKeywordIds}
      />

      {/* ── Locale tabs ── */}
      <section className="mt-8">
        <div className="flex items-center gap-1 border-b border-neutral-800">
          {BLOG_LOCALES.map((loc) => {
            const complete = isTranslationComplete(translations[loc]);
            return (
              <button
                key={loc}
                type="button"
                onClick={() => setActiveLocale(loc)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors inline-flex items-center gap-1.5 ${
                  activeLocale === loc
                    ? 'border-neutral-100 text-neutral-50'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {loc.toUpperCase()}
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    complete ? 'bg-emerald-500' : 'bg-neutral-600'
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Title">
            <input
              type="text"
              value={active.title}
              onChange={(e) => setTr(activeLocale, { title: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Excerpt">
            <textarea
              value={active.excerpt}
              onChange={(e) => setTr(activeLocale, { excerpt: e.target.value })}
              rows={2}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="SEO title">
              <input
                type="text"
                value={active.seoTitle}
                onChange={(e) => setTr(activeLocale, { seoTitle: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="SEO description">
              <input
                type="text"
                value={active.seoDescription}
                onChange={(e) => setTr(activeLocale, { seoDescription: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Body (MDX source)">
            <MarkdownEditor
              value={active.bodyRaw}
              onChange={(next) => setTr(activeLocale, { bodyRaw: next })}
            />
            <Hint>
              MDX source — JSX components and <code>&lt;!-- SPEC_TABLES_* --&gt;</code> markers are
              preserved verbatim and render on the live site.
            </Hint>
          </Field>

          <FaqEditor items={active.faq} onChange={(faq) => setTr(activeLocale, { faq })} />
        </div>
      </section>

      {/* ── Action bar ── */}
      <div className="mt-8 sticky bottom-0 -mx-4 px-4 py-4 border-t border-neutral-800 bg-neutral-950/90 backdrop-blur flex flex-wrap items-center gap-3">
        {!post ? (
          <ActionButton
            primary
            onClick={handleCreate}
            loading={pendingAction === 'create'}
            disabled={busy}
          >
            Create draft
          </ActionButton>
        ) : (
          <>
            <ActionButton
              primary
              onClick={handleSave}
              loading={pendingAction === 'save'}
              disabled={busy}
            >
              Save
            </ActionButton>
            {status !== BlogPostStatus.PUBLISHED && (
              <ActionButton
                onClick={handlePublish}
                loading={pendingAction === 'publish'}
                disabled={busy}
              >
                Publish
              </ActionButton>
            )}
            {status === BlogPostStatus.PUBLISHED && (
              <ActionButton
                onClick={handleUnpublish}
                loading={pendingAction === 'unpublish'}
                disabled={busy}
              >
                Unpublish
              </ActionButton>
            )}
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
                className="px-2 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 text-sm"
              />
              <ActionButton
                onClick={handleSchedule}
                loading={pendingAction === 'schedule'}
                disabled={busy}
              >
                Schedule
              </ActionButton>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="ml-auto px-3 py-2 rounded-lg border border-red-900 text-red-300 text-sm hover:bg-red-950/40 transition-colors disabled:opacity-50"
            >
              {pendingAction === 'delete' ? <Spinner /> : 'Delete'}
            </button>
          </>
        )}
        {scheduleAt && (
          <p className="w-full text-xs text-neutral-500">
            Schedules in UTC: {localInputToUtcIso(scheduleAt) ?? 'invalid'}
          </p>
        )}
      </div>

      {showVersions && post && (
        <VersionDrawer
          postId={post.id}
          currentStatus={status}
          onClose={() => setShowVersions(false)}
          onReverted={async () => {
            await queryClient.invalidateQueries({ queryKey: ['admin', 'blog-post', post.id] });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Taxonomy picker (with inline create) ───
function TaxonomyPicker({
  taxonomy,
  categoryIds,
  keywordIds,
  onCategoryIds,
  onKeywordIds,
}: {
  taxonomy: BlogTaxonomyQuery | undefined;
  categoryIds: string[];
  keywordIds: string[];
  onCategoryIds: (ids: string[]) => void;
  onKeywordIds: (ids: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const createCategory = useMutation({
    mutationFn: (name: string) => gqlFetcher(CreateBlogCategoryDocument, { input: { name } }),
    onSuccess: (res) => {
      onCategoryIds([...categoryIds, res.createBlogCategory.id]);
      setNewCategory('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog-taxonomy'] });
    },
  });
  const createKeyword = useMutation({
    mutationFn: (name: string) => gqlFetcher(CreateBlogKeywordDocument, { input: { name } }),
    onSuccess: (res) => {
      onKeywordIds([...keywordIds, res.createBlogKeyword.id]);
      setNewKeyword('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'blog-taxonomy'] });
    },
  });

  const toggle = (ids: string[], id: string, set: (next: string[]) => void) =>
    set(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  return (
    <section className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-2 uppercase tracking-wide">
          Categories <span className="text-neutral-500">(first = primary)</span>
        </h2>
        <ChipSet
          items={taxonomy?.adminBlogCategories ?? []}
          selected={categoryIds}
          onToggle={(id) => toggle(categoryIds, id, onCategoryIds)}
        />
        <CreateInline
          value={newCategory}
          onChange={setNewCategory}
          onCreate={() => newCategory.trim() && createCategory.mutate(newCategory.trim())}
          loading={createCategory.isPending}
          placeholder="New category…"
        />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-neutral-300 mb-2 uppercase tracking-wide">
          Keywords
        </h2>
        <ChipSet
          items={taxonomy?.adminBlogKeywords ?? []}
          selected={keywordIds}
          onToggle={(id) => toggle(keywordIds, id, onKeywordIds)}
        />
        <CreateInline
          value={newKeyword}
          onChange={setNewKeyword}
          onCreate={() => newKeyword.trim() && createKeyword.mutate(newKeyword.trim())}
          loading={createKeyword.isPending}
          placeholder="New keyword…"
        />
      </div>
    </section>
  );
}

function ChipSet({
  items,
  selected,
  onToggle,
}: {
  items: { id: string; name: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">None yet — create one below.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const on = selected.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onToggle(it.id)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              on
                ? 'bg-neutral-100 text-neutral-900 border-neutral-100'
                : 'border-neutral-700 text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            {it.name}
          </button>
        );
      })}
    </div>
  );
}

function CreateInline({
  value,
  onChange,
  onCreate,
  loading,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onCreate: () => void;
  loading: boolean;
  placeholder: string;
}) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCreate();
          }
        }}
        placeholder={placeholder}
        className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 text-sm focus:outline-none focus:border-neutral-500"
      />
      <button
        type="button"
        onClick={onCreate}
        disabled={loading || !value.trim()}
        className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-200 text-sm hover:bg-neutral-800 transition-colors disabled:opacity-50"
      >
        {loading ? <Spinner /> : 'Add'}
      </button>
    </div>
  );
}

// ─── FAQ editor ───
function FaqEditor({ items, onChange }: { items: FaqItem[]; onChange: (next: FaqItem[]) => void }) {
  const update = (i: number, patch: Partial<FaqItem>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  return (
    <Field label="FAQ (renders FAQPage structured data)">
      <div className="space-y-3">
        {items.map((it, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: FAQ rows are positional and reorder-free
            key={i}
            className="p-3 rounded-lg border border-neutral-800 bg-neutral-900 space-y-2"
          >
            <input
              type="text"
              value={it.question}
              onChange={(e) => update(i, { question: e.target.value })}
              placeholder="Question"
              className={inputClass}
            />
            <textarea
              value={it.answer}
              onChange={(e) => update(i, { answer: e.target.value })}
              placeholder="Answer"
              rows={2}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, { question: '', answer: '' }])}
          className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-200 text-sm hover:bg-neutral-800 transition-colors"
        >
          + Add FAQ item
        </button>
      </div>
    </Field>
  );
}

// ─── Version drawer ───
function VersionDrawer({
  postId,
  currentStatus,
  onClose,
  onReverted,
}: {
  postId: string;
  currentStatus: string;
  onClose: () => void;
  onReverted: () => void;
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'blog-versions', postId],
    queryFn: () => gqlFetcher(AdminBlogPostVersionsDocument, { id: postId }),
  });
  const [reverting, setReverting] = useState<number | null>(null);

  const revert = async (versionNum: number) => {
    if (!confirm(`Revert to version ${versionNum}? Current state is snapshotted first.`)) return;
    setReverting(versionNum);
    try {
      await gqlFetcher(RevertBlogPostVersionDocument, { id: postId, versionNum });
      onReverted();
      onClose();
    } finally {
      setReverting((cur) => (cur === versionNum ? null : cur));
    }
  };

  const versions = data?.adminBlogPostVersions ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismisses drawer */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} role="presentation" />
      <div className="relative w-full max-w-md h-full bg-neutral-900 border-l border-neutral-800 p-5 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-50">Version history</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-neutral-800 text-neutral-400"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {isLoading && (
          <div className="mt-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {isError && <p className="mt-6 text-sm text-red-400">Failed to load versions.</p>}
        {!isLoading && !isError && versions.length === 0 && (
          <p className="mt-6 text-sm text-neutral-500">
            No snapshots yet. Versions are captured each time a post is published.
          </p>
        )}

        <ul className="mt-5 space-y-3 list-none p-0">
          {versions.map((v, idx) => (
            <li
              key={v.versionNum}
              className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/60"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-100 truncate">
                    v{v.versionNum} · {v.title ?? 'Untitled'}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {new Date(v.createdAt).toLocaleString()}
                    {v.status ? ` · ${v.status}` : ''}
                    {idx === 0 ? ' · latest' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revert(v.versionNum)}
                  disabled={reverting !== null}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-200 text-xs hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {reverting === v.versionNum ? <Spinner /> : 'Revert'}
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-neutral-600">Current status: {currentStatus}</p>
      </div>
    </div>
  );
}

// ─── Small presentational helpers ───
const inputClass =
  'w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 text-sm focus:outline-none focus:border-neutral-500';
const selectClass = `${inputClass} appearance-none`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="block">
      <span className="block text-sm font-medium text-neutral-300 mb-1.5">{label}</span>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="block mt-1 text-xs text-neutral-500">{children}</span>;
}

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-neutral-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-neutral-600 bg-neutral-900"
      />
      {label}
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  loading,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 inline-flex items-center gap-2 ${
        primary
          ? 'bg-neutral-100 text-neutral-900 hover:bg-white'
          : 'border border-neutral-700 text-neutral-200 hover:bg-neutral-800'
      }`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}
