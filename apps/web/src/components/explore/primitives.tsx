import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Globe,
  List,
  type LucideIcon,
  Map as MapIcon,
  MapPin,
  Mountain,
  Route,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { TripTemplateNode } from '@/lib/fetch-places';
import './explore.css';
import { formatDuration, formatNumber } from './utils';

/* ── MetaLabel: a sentence-case body-face label ───────────────── */

export function MetaLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className ? `xp-label ${className}` : 'xp-label'}>{children}</span>;
}

/* ── Icon: Lucide, one stroke weight ──────────────────────────── */

const ICONS = {
  search: Search,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'chevron-down': ChevronDown,
  sliders: SlidersHorizontal,
  close: X,
  map: MapIcon,
  list: List,
  pin: MapPin,
  building: Building2,
  distance: Route,
  elev: Mountain,
  time: Clock,
  check: Check,
  globe: Globe,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 16,
  color = 'currentColor',
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  const Glyph = ICONS[name];
  return <Glyph size={size} color={color} strokeWidth={1.75} aria-hidden="true" />;
}

/* ── Figure: a condensed, tabular number with its unit and label ── */

export function Figure({
  value,
  unit,
  label,
  size = 'md',
}: {
  value: string;
  unit?: string;
  label?: string;
  size?: 'md' | 'lg' | 'xl';
}) {
  return (
    <span className={`xp-figure xp-figure-${size}`}>
      <span className="mv-figure xp-figure-value">
        {value}
        {unit && <span className="xp-figure-unit">{unit}</span>}
      </span>
      {label && <span className="xp-figure-label">{label}</span>}
    </span>
  );
}

/* ── Route figures: distance, climb, time for one trip ─────────── */

export function distanceParts(meters: number): { value: string; unit: string } {
  const km = meters / 1000;
  return { value: km >= 100 ? formatNumber(Math.round(km)) : km.toFixed(1), unit: 'km' };
}

type RouteFigureSource = Pick<
  TripTemplateNode,
  'distanceM' | 'elevationGainM' | 'estimatedDurationMinutes'
>;

export function RouteFigures({
  trip,
  withLabels = true,
  size = 'md',
}: {
  trip: RouteFigureSource;
  withLabels?: boolean;
  size?: 'md' | 'lg';
}) {
  const figures: Array<{ key: string; value: string; unit?: string; label: string }> = [];
  if (trip.distanceM != null) {
    const d = distanceParts(trip.distanceM);
    figures.push({ key: 'distance', value: d.value, unit: d.unit, label: 'Distance' });
  }
  if (trip.elevationGainM != null) {
    figures.push({
      key: 'climb',
      value: formatNumber(trip.elevationGainM),
      unit: 'm',
      label: 'Climb',
    });
  }
  if (trip.estimatedDurationMinutes != null) {
    figures.push({
      key: 'time',
      value: formatDuration(trip.estimatedDurationMinutes),
      label: 'Riding time',
    });
  }
  if (figures.length === 0) return null;
  return (
    <span className="xp-figures">
      {figures.map((f) => (
        <Figure
          key={f.key}
          value={f.value}
          unit={f.unit}
          label={withLabels ? f.label : undefined}
          size={size}
        />
      ))}
    </span>
  );
}

/* ── Skeleton rows (static — no shimmer loop) ──────────────────── */

const SKELETON_ROW_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="xp-rows" aria-hidden="true">
      {SKELETON_ROW_KEYS.slice(0, count).map((key) => (
        <div key={key} className="xp-row">
          <span>
            <span className="xp-skel" style={{ width: '46%' }} />
            <span className="xp-skel" style={{ width: '28%', height: 11, marginTop: 8 }} />
          </span>
          <span className="xp-row-figs">
            <span className="xp-skel" style={{ width: 56, height: 20 }} />
            <span className="xp-skel" style={{ width: 56, height: 20 }} />
          </span>
        </div>
      ))}
    </div>
  );
}
