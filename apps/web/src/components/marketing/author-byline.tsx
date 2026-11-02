import { getFormatter } from 'next-intl/server';
import type { Author } from '@/lib/authors';

interface AuthorBylineProps {
  author: Author;
  date?: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Compact byline rendered under an article title: initials, name, role and
 * the publish date, all in the body face (`.mv-read-byline`). Server
 * component — no client JS.
 *
 * Formatting goes through next-intl's `getFormatter()` rather than
 * `toLocaleDateString(locale)`. This is not a style preference: the component
 * used to take the `[locale]` route segment as a prop and hand it straight to
 * `Intl`, and that segment is untrusted. `src/proxy.ts` matches
 * `/((?!api|_next|_vercel|apple-app-site-association|.*\..*).*)`, whose
 * `.*\..*` clause excludes any path containing a dot — so
 * `/motovault.app/blog/<slug>` (a crawler following a site-absolute link that
 * lost its scheme) never reaches the next-intl middleware and lands here with
 * `locale === 'motovault.app'`, throwing
 * `RangeError: Incorrect locale information provided` — a hard 500 on an
 * indexable route (Sentry MOTOVAULT-WEB-16).
 *
 * `getFormatter()` takes its locale from the request config
 * (`src/i18n/request.ts`), which already narrows through `hasLocale()` and
 * falls back to `routing.defaultLocale`. A bogus segment is therefore
 * structurally incapable of reaching `Intl` — no sanitising at the call site
 * required. It also picks up the configured time zone, so the output cannot
 * drift between environments.
 */
export async function AuthorByline({ author, date }: AuthorBylineProps) {
  const initials = getInitials(author.name);
  const format = await getFormatter();
  const formattedDate = date
    ? format.dateTime(new Date(date), {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="mv-read-byline">
      <span aria-hidden="true" className="mv-read-avatar">
        {initials}
      </span>
      <div className="mv-read-byline-text">
        <span>
          <strong>{author.name}</strong>
          {formattedDate && (
            <>
              <span aria-hidden="true"> · </span>
              <time dateTime={date}>{formattedDate}</time>
            </>
          )}
        </span>
        <span className="mv-read-byline-role">{author.role}</span>
      </div>
    </div>
  );
}
