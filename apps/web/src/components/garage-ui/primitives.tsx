import type { CSSProperties, ElementType, ReactNode } from 'react';
import './garage-ui.css';

/** Card padding steps from the spec (phone / tablet / desktop). */
export const CardPadding = {
  /** 0 and overflow hidden (bike hero: photo bleeds to the edge). */
  None: 'none',
  /** 20 / 24 / 24 (rides card, empty-state blocks). */
  Md: 'md',
  /** 20 / 24 / 28 (next-service and spend cards). */
  Lg: 'lg',
} as const;
export type CardPadding = (typeof CardPadding)[keyof typeof CardPadding];

export const CardTone = {
  /** --mv-card (#1E1C19): the content cards. */
  Card: 'card',
  /** --mv-surface-2: raised handoff surfaces (rail, band, empty hero). */
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
 * The garage card shell: --mv-card fill, 1px --mv-line border, radius 20.
 * Layout inside (gap, grid) is the caller's.
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
  /** `h2` for a card heading, `div`/`span` for a plain overline. Default `div`. */
  as?: ElementType;
  id?: string;
  /** Leading 24px rule (page eyebrow: "— Garage · 1 bike · Read-only on the web"). */
  rule?: boolean;
  /** Copper text (--mv-copper-400), e.g. "Start in the app". */
  accent?: boolean;
  className?: string;
  children: ReactNode;
};

/** Geist Mono 11/500, +0.18em, caps, --mv-ink-2. */
export function MonoLabel({
  as: Tag = 'div',
  id,
  rule = false,
  accent = false,
  className,
  children,
}: MonoLabelProps) {
  const classes = [
    'mvg-eyebrow',
    rule ? 'mvg-eyebrow--rule' : null,
    accent ? 'mvg-eyebrow--copper' : null,
    className,
  ]
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
  /** Default 8. Use 9999 for pills, 12 for rows, 20 for cards. */
  radius?: number;
  className?: string;
};

/**
 * Loading block: --mv-skel (white 6%) with a 1.2 s shimmer, static under
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

/** Instrument Serif accent word(s) inside a sans heading (upright, same ink). */
export function SerifAccent({ children }: { children: ReactNode }) {
  return <span className="mvg-serif">{children}</span>;
}
