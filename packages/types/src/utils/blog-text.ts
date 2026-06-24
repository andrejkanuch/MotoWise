/**
 * Shared blog text derivation (plan U5/KTD11). Used by every code path that writes
 * `blog_post_translations.body_raw` — the web import script (U3), the maintenance
 * generator (U10), and the NestJS admin mutations (U5) — so the FTS `body_text`
 * column is derived identically everywhere and can't drift.
 */

/**
 * Reduce MDX/markdown body to plain text for the FTS `body_text` column. Strips
 * code fences, HTML/JSX tags, MDX comment markers, image/link syntax, table and
 * emphasis punctuation, then collapses whitespace. Not a renderer — denoised text.
 */
export function stripMdxToText(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/<!--[\s\S]*?-->/g, ' ') // html comments
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ') // mdx comments ({/* SPEC_TABLES */})
    .replace(/<[^>]+>/g, ' ') // html/jsx tags
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[|#>*_~]/g, ' ') // table/heading/emphasis punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

/** Word count of the stripped plain text (0 for empty). */
export function wordCount(plainText: string): number {
  return plainText ? plainText.split(/\s+/).length : 0;
}
