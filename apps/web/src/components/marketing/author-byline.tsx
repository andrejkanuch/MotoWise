import type { Author } from '@/lib/authors';

interface AuthorBylineProps {
  author: Author;
  date?: string;
  locale?: string;
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
 * Compact byline rendered near an article title. Avatar initials + name + role
 * + optional publish date. Server component — no client JS.
 */
export function AuthorByline({ author, date, locale = 'en' }: AuthorBylineProps) {
  const initials = getInitials(author.name);
  const formattedDate = date
    ? new Date(date).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <div className="flex items-center gap-3">
      <div
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-xs font-semibold text-neutral-300"
      >
        {initials}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-sm text-neutral-300">
          <span className="text-neutral-500">By </span>
          <span className="font-medium text-neutral-200">{author.name}</span>
          {formattedDate && (
            <>
              <span className="mx-1.5 text-neutral-600" aria-hidden="true">
                ·
              </span>
              <time dateTime={date} className="text-neutral-500">
                {formattedDate}
              </time>
            </>
          )}
        </span>
        <span className="text-xs text-neutral-500">{author.role}</span>
      </div>
    </div>
  );
}
