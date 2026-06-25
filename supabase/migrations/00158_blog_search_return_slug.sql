-- ce-code-review #11: search_blog_posts returned only post_id, forcing the web
-- reader to fire a second query to map ids -> slugs. Return slug directly so the
-- hydration round-trip is removed. A RETURNS TABLE column change can't go through
-- CREATE OR REPLACE, so DROP + CREATE and re-grant EXECUTE (mirrors 00157).
--
-- Applied to prod (tpsoneenbrmdwvzcbifw) via the management API on 2026-06-25.
-- Safe: search_blog_posts has no production consumer yet (the blog CMS is on this
-- branch and not deployed); the web reader (supabase-blog.ts) also tolerates the
-- old post_id-only shape via a hydration fallback.
BEGIN;

DROP FUNCTION IF EXISTS public.search_blog_posts(text, text);

CREATE FUNCTION public.search_blog_posts(query text, loc text DEFAULT 'en')
  RETURNS TABLE(post_id uuid, slug text, rank real)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  cfg regconfig;
  ts  tsquery;
BEGIN
  IF query IS NULL OR char_length(query) = 0 OR char_length(query) > 200 THEN
    RETURN;
  END IF;
  cfg := public.blog_locale_config(loc);
  ts  := websearch_to_tsquery(cfg, query);

  RETURN QUERY
  SELECT t.post_id,
    p.slug,
    (
      ts_rank(t.search_vector, ts)
      + word_similarity(query, t.title) * 0.3
      + CASE WHEN p.published_at > now() - interval '30 days' THEN 0.3 ELSE 0 END
    )::real AS rank
  FROM public.blog_post_translations t
  JOIN public.blog_posts p ON p.id = t.post_id
  WHERE p.status = 'published'
    AND t.locale = loc
    AND (t.search_vector @@ ts OR word_similarity(query, t.title) > 0.3)
  ORDER BY rank DESC
  LIMIT 50;
END $function$;

REVOKE EXECUTE ON FUNCTION public.search_blog_posts(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_blog_posts(text, text) TO anon, authenticated;

COMMIT;
