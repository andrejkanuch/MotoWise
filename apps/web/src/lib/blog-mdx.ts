/**
 * Strip raw HTML comments from an article body before MDX compilation.
 *
 * Generated article bodies occasionally carry `<!-- … -->`, which is invalid
 * MDX ("Unexpected character `!` before name") and would kill the whole page
 * (Sentry MOTOVAULT-WEB-S). Comments are invisible content, so removing them
 * never changes what renders.
 *
 * Known tradeoff: the regex is not code-fence aware, so a comment shown as
 * example content inside a fenced code block is also removed. Acceptable for
 * this content domain (motorcycle guides); if it ever bites, replace with a
 * remark plugin that skips code nodes. An unterminated `<!--` is left alone
 * and still lands in the page's compileMDX try/catch.
 */
export function stripHtmlComments(source: string): string {
  return source.replace(/<!--[\s\S]*?-->/g, '');
}
