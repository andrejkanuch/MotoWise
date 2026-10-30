import type { CSSProperties, ElementType, ReactNode } from 'react';
import './garage-ui.css';

/** Card padding steps (phone / tablet / desktop). */
export const CardPadding = {
  /** 0 and overflow hidden (a photo bleeds to the edge). */
  None: 'none',
  /** 20 / 24 / 24. */
  Md: 'md',
  /** 20 / 24 / 28. */
  Lg: 'lg',
} as const;
export type CardPadding = (typeof CardPadding)[keyof typeof CardPadding];

export const CardTone = {
  /** --mv-surface: one step up from the page. */
  Card: 'card',
  /** --mv-surface-2: two steps up (the handoff rail and band). */
  Raised: 'raised',
} as const;
export type CardTone = (typeof CardTone)[keyof typeof CardTone];

type GarageCardProps = {
  /** Element to render; default `section`. */
  as?: ElementType;
  padding?: CardPadding;
  tone?: CardTone;
  /** Id of the card's heading; required for a `section` to be a named landmark. */
  'aria-labelledby'?: string;
  'aria-label'?: string;
  className?: string;
  /** Layout only (grid, gap, flex). Never colours: those come from the tokens. */
  style?: CSSProperties;
  children: ReactNode;
};

/**
 * The one card-styled element a section may have: a step up the ramp, a
 * hairline, radius 16, no shadow (the Ramp Is the Shadow Rule). Layout
 * inside (gap, grid) is the caller's.
 */
export function GarageCard({
  as: Tag = 'section',
  padding = CardPadding.Lg,
  tone = CardTone.Card,
  className,
  style,
  children,
  ...aria
}: GarageCardProps) {
  const classes = [
    'mvg-card',
    `mvg-card--pad-${padding}`,
    tone === CardTone.Raised ? 'mvg-card--raised' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag className={classes} style={style} {...aria}>
      {children}
    </Tag>
  );
}

type MonoLabelProps = {
  /** `h2` for a section heading, `div`/`span` for a plain caption. Default `div`. */
  as?: ElementType;
  id?: string;
  /** Kept for callers; the label carries no rule in the Trackside world. */
  rule?: boolean;
  /** Copper text (--mv-copper-text): only when the label names an action. */
  accent?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * A sentence-case caption in the system face at --mv-ink-3 ("Odometer",
 * "Also in your garage · 2"). The name is historical: it is no longer mono,
 * never uppercase and never letter-spaced (the Plain Voice Rule).
 */
export function MonoLabel({
  as: Tag = 'div',
  id,
  accent = false,
  className,
  children,
}: MonoLabelProps) {
  const classes = ['mvg-eyebrow', accent ? 'mvg-eyebrow--copper' : null, className]
    .filter(Boolean)
    .join(' ');
  return (
    <Tag id={id} className={classes}>
      {children}
    </Tag>
  );
}

type SkeletonProps = {
  width?: CSSProperties['width'];
  height: CSSProperties['height'];
  /** Default 8. Use 9999 for pills, 12 for rows, 20 for the plate. */
  radius?: number;
  className?: string;
};

/**
 * Loading block: --mv-skel with a 1.2 s --mv-skel-shine shimmer, static under
 * prefers-reduced-motion. Decorative: put `aria-busy` on the region that loads.
 */
export function Skeleton({ width = '100%', height, radius = 8, className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={className ? `mvg-skel ${className}` : 'mvg-skel'}
      style={{ width, height, borderRadius: radius }}
    />
  );
}

/** Condensed display accent inside a title (same ink). The serif is retired. */
export function SerifAccent({ children }: { children: ReactNode }) {
  return <span className="mvg-serif">{children}</span>;
}
