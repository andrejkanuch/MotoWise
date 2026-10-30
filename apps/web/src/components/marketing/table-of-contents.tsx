import type { TocHeading } from '@/lib/rehype-extract-headings';

interface TableOfContentsProps {
  headings: TocHeading[];
}

/** A plain hairline list of the article's headings (`.mv-read-toc`). */
export function TableOfContents({ headings }: TableOfContentsProps) {
  if (headings.length === 0) return null;

  return (
    <details open className="mv-read-toc">
      <summary>
        In this article
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <nav aria-label="Table of contents">
        <ol>
          {headings.map((heading) => (
            <li key={heading.id} data-level={heading.level}>
              <a href={`#${heading.id}`}>{heading.text}</a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
