/** Target id for {@link SkipLink}; put it on the layout's `<main>`. */
export const MAIN_CONTENT_ID = 'main-content';

/**
 * First tab stop of a page: jumps past the navbar to `<main id="main-content">`.
 * Visually hidden until focused, then the copper pill in the top-left corner.
 * The marketing layout renders the same anchor inline; root-only layouts
 * (auth, /pro, …) render this one.
 */
export function SkipLink({ label = 'Skip to content' }: { label?: string }) {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:px-4 focus:py-2"
      style={{ background: 'var(--mv-copper)', color: 'var(--mv-on-copper)' }}
    >
      {label}
    </a>
  );
}
