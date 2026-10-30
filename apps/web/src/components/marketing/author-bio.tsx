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
 * Author row at the end of an article: initials, name, role, bio, credentials
 * in one line and optional profile links. One hairline above, no card
 * (`.mv-read-author`).
 */
export function AuthorBio({ author }: AuthorBioProps) {
  const initials = getInitials(author.name);
  const socials = author.socials ?? {};
  const links = [
    socials.x ? { href: socials.x, label: 'X' } : null,
    socials.linkedin ? { href: socials.linkedin, label: 'LinkedIn' } : null,
    socials.instagram ? { href: socials.instagram, label: 'Instagram' } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);

  return (
    <aside aria-label={`About ${author.name}`} className="mv-read-author">
      <span aria-hidden="true" className="mv-read-avatar lg">
        {initials}
      </span>
      <div>
        <p className="mv-read-author-name">{author.name}</p>
        <p className="mv-read-author-role">{author.role}</p>
        <p className="mv-read-author-bio">{author.bio}</p>
        {author.credentials.length > 0 && (
          <ul className="mv-read-author-creds">
            {author.credentials.map((credential) => (
              <li key={credential}>{credential}</li>
            ))}
          </ul>
        )}
        {links.length > 0 && (
          <div className="mv-read-author-links">
            {links.map((link) => (
              <a key={link.href} href={link.href} rel="noopener noreferrer me" target="_blank">
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
