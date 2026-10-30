import type { Author } from '@/lib/authors';

interface AuthorBioProps {
  author: Author;
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
 * Full author card — avatar + name + role + bio + credential bullets +
 * optional social links. Visual treatment mirrors the "Founder's Note" block
 * on /features/trip-planning for consistency with the rest of the site.
 */
export function AuthorBio({ author }: AuthorBioProps) {
  const initials = getInitials(author.name);
  const socials = author.socials ?? {};
  const hasSocials = Boolean(socials.x || socials.linkedin || socials.instagram);

  return (
    <aside
      aria-label={`About ${author.name}`}
      className="rounded-2xl border border-(--mv-line) bg-(--mv-surface) p-6 md:p-8"
    >
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-(--mv-line) bg-(--mv-surface-2) text-base font-semibold text-(--mv-ink-2)"
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-(--mv-ink-3)">About the author</p>
          <h2 className="mt-1.5 text-xl font-bold text-(--mv-ink)">{author.name}</h2>
          <p className="mt-0.5 text-sm text-(--mv-ink-3)">{author.role}</p>
        </div>
      </div>

      <p className="mt-5 text-base leading-relaxed text-(--mv-ink-2)">{author.bio}</p>

      {author.credentials.length > 0 && (
        <ul className="mt-5 space-y-2">
          {author.credentials.map((credential) => (
            <li key={credential} className="flex items-start gap-2.5 text-sm text-(--mv-ink-2)">
              <span
                aria-hidden="true"
                className="mt-[7px] size-1.5 shrink-0 rounded-full bg-(--mv-ink-4)"
              />
              <span>{credential}</span>
            </li>
          ))}
        </ul>
      )}

      {hasSocials && (
        <div className="mt-6 flex items-center gap-3 border-t border-(--mv-line) pt-4">
          {socials.x && (
            <a
              href={socials.x}
              rel="noopener noreferrer me"
              target="_blank"
              className="text-sm text-(--mv-ink-2) transition-colors hover:text-(--mv-copper-text)"
            >
              X / Twitter
            </a>
          )}
          {socials.linkedin && (
            <a
              href={socials.linkedin}
              rel="noopener noreferrer me"
              target="_blank"
              className="text-sm text-(--mv-ink-2) transition-colors hover:text-(--mv-copper-text)"
            >
              LinkedIn
            </a>
          )}
          {socials.instagram && (
            <a
              href={socials.instagram}
              rel="noopener noreferrer me"
              target="_blank"
              className="text-sm text-(--mv-ink-2) transition-colors hover:text-(--mv-copper-text)"
            >
              Instagram
            </a>
          )}
        </div>
      )}
    </aside>
  );
}
