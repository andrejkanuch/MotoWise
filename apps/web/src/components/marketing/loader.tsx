/**
 * MotoVault branded loader — compass-style rotating wheel with
 * animated tread ring and breathing hub.
 *
 * Sizes: "sm" (44px) · default (80px) · "lg" (140px)
 */
export function MvLoader({ size, label }: { size?: 'sm' | 'lg'; label?: string }) {
  const spinner = (
    <div className={`mv-loader${size ? ` ${size}` : ''}`}>
      <div className="mv-loader-tread" />
      <div className="mv-loader-hub" />
    </div>
  );

  if (!label) {
    return (
      <div role="status" aria-live="polite">
        {spinner}
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div className="mv-loader-wrap" role="status" aria-live="polite">
      {spinner}
      <div className="mv-loader-text">
        {label}
        <span className="mv-dots" />
      </div>
    </div>
  );
}
