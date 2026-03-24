import type { TocHeading } from '@/lib/rehype-extract-headings';

interface TableOfContentsProps {
  headings: TocHeading[];
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  if (headings.length === 0) return null;

  return (
    <details
      open
      className="mb-10 rounded-xl border border-neutral-800 bg-neutral-800/60 px-6 py-4"
    >
      <summary className="cursor-pointer text-sm font-semibold text-amber-500 select-none">
        Table of Contents
      </summary>
      <nav aria-label="Table of contents" className="mt-3">
        <ol className="list-none space-y-1">
          {headings.map((heading) => (
            <li key={heading.id} className={heading.level === 3 ? 'pl-4' : ''}>
              <a
                href={`#${heading.id}`}
                className="text-sm text-neutral-300 transition-colors hover:text-amber-400"
              >
                {heading.text}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}
