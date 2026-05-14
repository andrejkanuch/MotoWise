'use client';

// TODO: Re-enable full theme cycling once light mode styles are configured
// Currently only dark mode is supported, so this renders a static icon.
export function ThemeToggle() {
  return (
    <div
      role="img"
      aria-label="Dark mode"
      className="flex h-8 w-8 items-center justify-center rounded-full text-[--color-on-surface-muted]"
    >
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
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </div>
  );
}
