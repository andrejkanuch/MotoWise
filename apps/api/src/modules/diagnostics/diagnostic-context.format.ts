import { EXPENSE_CATEGORY_META, type MileageUnit, metersToUnit } from '@motovault/types';
import { differenceInCalendarDays, isBefore, parseISO, startOfDay, subDays } from 'date-fns';

/**
 * Pure rendering for the per-bike `<bike_context>` block sent to the diagnostic
 * AI. Everything here is deterministic and side-effect free; the data reads
 * live in `diagnostic-context.builder.ts`.
 *
 * Budget: every section has a display cap, every line is truncated, and the
 * whole block stops at MAX_BIKE_CONTEXT_CHARS (~1000 tokens) at a line
 * boundary. Sections are rendered in priority order, so the lowest-priority
 * sections are the ones dropped when the budget runs out.
 */

/** How many items each section shows. The builder fetches more (FETCH_LIMIT) so relevance has a choice. */
export const BIKE_CONTEXT_CAPS = {
  COMPLETED_SERVICES: 8,
  OPEN_SERVICES: 6,
  EXPENSES: 8,
  NOTES: 5,
  PREVIOUS_DIAGNOSES: 3,
} as const;

export const MAX_LINE_CHARS = 160;
const MAX_NOTE_CHARS = 240;
export const MAX_BIKE_CONTEXT_CHARS = 4000;
const RIDE_USAGE_WINDOW_DAYS = 90;
export const TRUNCATION_MARKER = '- (more history omitted to stay within budget)';

/** What the rider's consent covers. `maintenance` is the legacy "maintenance history" toggle scope. */
export const BIKE_CONTEXT_SCOPE = {
  FULL: 'full',
  MAINTENANCE: 'maintenance',
} as const;
export type BikeContextScope = (typeof BIKE_CONTEXT_SCOPE)[keyof typeof BIKE_CONTEXT_SCOPE];

/**
 * Symptom area -> keywords. Keys match the mobile wizard's location options
 * (sent comma-joined in `wizardAnswers.location`). English-only in v1: item
 * text written in another language simply falls back to recency ordering.
 */
const SYMPTOM_AREA_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  electrical: [
    'batter',
    'stator',
    'regulator',
    'rectifier',
    'alternator',
    'charging',
    'charge',
    'fuse',
    'wiring',
    'wire',
    'starter',
    'relay',
    'ignition',
    'coil',
    'spark',
    'light',
    'bulb',
    'ecu',
    'sensor',
    'voltage',
  ],
  engine: [
    'oil',
    'engine',
    'valve',
    'carb',
    'injector',
    'fuel',
    'spark',
    'plug',
    'coolant',
    'radiator',
    'gasket',
    'piston',
    'camshaft',
    'filter',
    'throttle',
    'idle',
    'misfire',
  ],
  brakes: ['brake', 'pad', 'rotor', 'disc', 'caliper', 'abs', 'master cylinder'],
  exhaust: ['exhaust', 'muffler', 'header', 'pipe', 'catalytic', 'o2', 'backfir'],
  tires: ['tire', 'tyre', 'wheel', 'puncture', 'pressure', 'tread', 'spoke'],
  suspension: ['fork', 'shock', 'suspension', 'damper', 'seal', 'bearing', 'steering'],
  chainDrivetrain: [
    'chain',
    'sprocket',
    'belt',
    'clutch',
    'gearbox',
    'transmission',
    'shaft',
    'final drive',
  ],
  bodywork: ['fairing', 'mirror', 'seat', 'tank', 'paint', 'body', 'windscreen', 'windshield'],
};

/** Wizard symptom option keys that point at an area even when no location was picked. */
const SYMPTOM_OPTION_AREAS: Readonly<Record<string, readonly string[]>> = {
  wontStart: ['electrical', 'engine'],
  stalling: ['engine', 'electrical'],
  warningLight: ['electrical'],
  spongyBrakes: ['brakes'],
  squealing: ['brakes'],
  grinding: ['brakes', 'chainDrivetrain'],
  overheating: ['engine'],
  poorFuelEconomy: ['engine'],
  performanceIssue: ['engine'],
  smoke: ['engine'],
  leak: ['engine'],
  backfiring: ['exhaust'],
  wobble: ['suspension', 'tires'],
  hardToSteer: ['suspension', 'tires'],
};

export interface SymptomInput {
  /** Comma-joined wizard location keys (or rider free text). */
  location?: string;
  /** Comma-joined wizard symptom keys (or rider free text). */
  symptoms?: string;
  freeTextDescription?: string;
  additionalNotes?: string;
}

export interface ServiceItem {
  title: string;
  description?: string | null;
  completedAt?: string | null;
  completedMileage?: number | null;
  dueDate?: string | null;
  targetMileage?: number | null;
  priority?: string | null;
}

export interface ExpenseItem {
  category: string;
  itemName?: string | null;
  description?: string | null;
  date: string;
}

export interface NoteItem {
  body: string;
  createdAt: string;
  odometer?: number | null;
}

export interface RideItem {
  startedAt: string;
  distanceM?: number | null;
}

export interface PreviousDiagnosisItem {
  createdAt: string;
  severity?: string | null;
  part?: string | null;
  description?: string | null;
  reportedSymptom?: string | null;
}

export interface BikeProfile {
  variant?: string | null;
  purchaseDate?: string | null;
  mileageUpdatedAt?: string | null;
}

export interface BikeContextData {
  profile?: BikeProfile;
  completedServices?: ServiceItem[];
  openServices?: ServiceItem[];
  expenses?: ExpenseItem[];
  rides?: RideItem[];
  previousDiagnoses?: PreviousDiagnosisItem[];
  notes?: NoteItem[];
}

export interface BikeContextOptions {
  now: Date;
  mileageUnit: MileageUnit;
  currentMileage?: number | null;
  /** Lowercased keywords for the symptom areas (see detectSymptomKeywords). */
  symptomKeywords: readonly string[];
}

const EXPENSE_LABELS: ReadonlyMap<string, string> = new Map(
  EXPENSE_CATEGORY_META.map((meta) => [meta.key, meta.label]),
);

/** Strip tag delimiters and newlines (prompt-injection hygiene) and cap the length. */
export function sanitizeLine(text: string | null | undefined, max = MAX_LINE_CHARS): string {
  if (!text) return '';
  const flat = text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

const splitKeys = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Word-start match so "oil" does not hit "coil" while "batter" still hits "battery". */
const matchesKeyword = (haystack: string, keyword: string) =>
  new RegExp(`\\b${escapeRegExp(keyword)}`, 'i').test(haystack);

/**
 * Derive the keyword set for the areas the rider's symptoms point at:
 * wizard location keys, wizard symptom keys, and any area keyword that
 * appears in their own words.
 */
export function detectSymptomKeywords(input: SymptomInput): string[] {
  const areas = new Set<string>();
  for (const key of splitKeys(input.location)) {
    if (SYMPTOM_AREA_KEYWORDS[key]) areas.add(key);
  }
  for (const key of splitKeys(input.symptoms)) {
    for (const area of SYMPTOM_OPTION_AREAS[key] ?? []) areas.add(area);
  }
  const riderText = [
    input.freeTextDescription,
    input.additionalNotes,
    input.symptoms,
    input.location,
  ]
    .filter(Boolean)
    .join(' ');
  if (riderText) {
    for (const [area, keywords] of Object.entries(SYMPTOM_AREA_KEYWORDS)) {
      if (keywords.some((keyword) => matchesKeyword(riderText, keyword))) areas.add(area);
    }
  }
  return [...new Set([...areas].flatMap((area) => SYMPTOM_AREA_KEYWORDS[area] ?? []))];
}

/**
 * Keep `cap` items from a newest-first list, preferring items that mention a
 * symptom keyword, then filling with the newest rest. Output stays newest-first.
 */
export function pickRelevantFirst<T>(
  items: readonly T[],
  textOf: (item: T) => string,
  keywords: readonly string[],
  cap: number,
): T[] {
  if (items.length <= cap) return [...items];
  const isRelevant = (item: T) => {
    const text = textOf(item);
    return keywords.some((keyword) => matchesKeyword(text, keyword));
  };
  const indexed = items.map((item, index) => ({ item, index }));
  const relevant = indexed.filter(({ item }) => isRelevant(item));
  const rest = indexed.filter(({ item }) => !isRelevant(item));
  return [...relevant, ...rest]
    .slice(0, cap)
    .sort((a, b) => a.index - b.index)
    .map(({ item }) => item);
}

const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

const withUnit = (value: number, unit: MileageUnit) =>
  `${Math.round(value).toLocaleString('en-US')} ${unit}`;

const isOverdue = (item: ServiceItem, opts: BikeContextOptions): boolean => {
  const byDate = !!item.dueDate && isBefore(parseISO(item.dueDate), startOfDay(opts.now));
  const byMileage =
    item.targetMileage != null &&
    opts.currentMileage != null &&
    item.targetMileage <= opts.currentMileage;
  return byDate || byMileage;
};

type SectionRenderer = (data: BikeContextData, opts: BikeContextOptions) => string[];

const section = (header: string, lines: string[]) => (lines.length ? [header, ...lines] : []);

const renderProfile: SectionRenderer = ({ profile }) => {
  if (!profile) return [];
  const lines = [
    profile.variant ? `- Variant: ${sanitizeLine(profile.variant)}` : '',
    profile.purchaseDate ? `- Owned since: ${day(profile.purchaseDate)}` : '',
    profile.mileageUpdatedAt ? `- Odometer last updated: ${day(profile.mileageUpdatedAt)}` : '',
  ].filter(Boolean);
  return section('Bike profile:', lines);
};

const renderOpenServices: SectionRenderer = ({ openServices = [] }, opts) => {
  const ranked = [...openServices].sort(
    (a, b) => Number(isOverdue(b, opts)) - Number(isOverdue(a, opts)),
  );
  const picked = pickRelevantFirst(
    ranked,
    (item) => `${item.title} ${item.description ?? ''}`,
    opts.symptomKeywords,
    BIKE_CONTEXT_CAPS.OPEN_SERVICES,
  );
  const lines = picked.map((item) => {
    const parts = [sanitizeLine(item.title)];
    if (isOverdue(item, opts)) parts.push('OVERDUE');
    if (item.dueDate) parts.push(`due ${day(item.dueDate)}`);
    if (item.targetMileage != null)
      parts.push(`due at ${withUnit(item.targetMileage, opts.mileageUnit)}`);
    if (item.priority) parts.push(`priority ${sanitizeLine(item.priority)}`);
    return `- ${parts.join(' | ')}`;
  });
  return section('Open and overdue service items:', lines);
};

const renderCompletedServices: SectionRenderer = ({ completedServices = [] }, opts) => {
  const picked = pickRelevantFirst(
    completedServices,
    (item) => `${item.title} ${item.description ?? ''}`,
    opts.symptomKeywords,
    BIKE_CONTEXT_CAPS.COMPLETED_SERVICES,
  );
  const lines = picked.map((item) => {
    const parts = [day(item.completedAt) || 'date unknown', sanitizeLine(item.title)];
    if (item.completedMileage != null) {
      parts.push(`at ${withUnit(item.completedMileage, opts.mileageUnit)}`);
    }
    const detail = sanitizeLine(item.description);
    if (detail) parts.push(detail);
    return `- ${parts.join(' | ')}`;
  });
  return section('Completed services (newest first):', lines);
};

const renderExpenses: SectionRenderer = ({ expenses = [] }, opts) => {
  const picked = pickRelevantFirst(
    expenses,
    (item) => `${item.itemName ?? ''} ${item.description ?? ''}`,
    opts.symptomKeywords,
    BIKE_CONTEXT_CAPS.EXPENSES,
  );
  const lines = picked.map((item) => {
    const what = [sanitizeLine(item.itemName), sanitizeLine(item.description)]
      .filter(Boolean)
      .join(' — ');
    const parts = [day(item.date), EXPENSE_LABELS.get(item.category) ?? item.category];
    if (what) parts.push(what);
    return `- ${parts.join(' | ')}`;
  });
  return section('Parts, service and mods purchased (newest first):', lines);
};

const renderUsage: SectionRenderer = ({ rides = [] }, opts) => {
  if (rides.length === 0) return [];
  const windowStart = subDays(startOfDay(opts.now), RIDE_USAGE_WINDOW_DAYS);
  const recent = rides.filter((ride) => !isBefore(parseISO(ride.startedAt), windowStart));
  const meters = recent.reduce((sum, ride) => sum + (ride.distanceM ?? 0), 0);
  const lastRide = rides.reduce(
    (latest, ride) => (ride.startedAt > latest ? ride.startedAt : latest),
    rides[0].startedAt,
  );
  const daysSince = differenceInCalendarDays(opts.now, parseISO(lastRide));
  return section('Recorded riding (app-tracked rides only):', [
    `- Rides in the last ${RIDE_USAGE_WINDOW_DAYS} days: ${recent.length} (${withUnit(metersToUnit(meters, opts.mileageUnit), opts.mileageUnit)})`,
    `- Last recorded ride: ${day(lastRide)} (${daysSince} days ago)`,
  ]);
};

const renderPreviousDiagnoses: SectionRenderer = ({ previousDiagnoses = [] }) => {
  const lines = previousDiagnoses.slice(0, BIKE_CONTEXT_CAPS.PREVIOUS_DIAGNOSES).map((item) => {
    const parts = [day(item.createdAt)];
    const reported = sanitizeLine(item.reportedSymptom);
    if (reported) parts.push(`rider reported: "${reported}"`);
    const assessed = [
      item.part ? `part ${sanitizeLine(item.part)}` : '',
      item.severity ? `severity ${sanitizeLine(item.severity)}` : '',
    ]
      .filter(Boolean)
      .join(', ');
    if (assessed) parts.push(`assessed: ${assessed}`);
    const summary = sanitizeLine(item.description);
    if (summary) parts.push(summary);
    return `- ${parts.join(' | ')}`;
  });
  return section(
    'Earlier AI assessments of this bike (unconfirmed hypotheses, not verified repairs):',
    lines,
  );
};

const renderNotes: SectionRenderer = ({ notes = [] }, opts) => {
  const picked = pickRelevantFirst(
    notes,
    (item) => item.body,
    opts.symptomKeywords,
    BIKE_CONTEXT_CAPS.NOTES,
  );
  const lines = picked.map((item) => {
    const at = item.odometer != null ? ` (at ${withUnit(item.odometer, opts.mileageUnit)})` : '';
    return `- ${day(item.createdAt)}${at}: ${sanitizeLine(item.body, MAX_NOTE_CHARS)}`;
  });
  return section("Owner's notes (newest first):", lines);
};

/** Sections in priority order — later ones are the first dropped when the budget runs out. */
const SECTION_RENDERERS: readonly SectionRenderer[] = [
  renderProfile,
  renderOpenServices,
  renderCompletedServices,
  renderExpenses,
  renderUsage,
  renderPreviousDiagnoses,
  renderNotes,
];

/**
 * Render the bounded bike-context text, or `undefined` when there is nothing
 * worth sending.
 */
export function formatBikeContext(
  data: BikeContextData,
  opts: BikeContextOptions,
): string | undefined {
  const sections = SECTION_RENDERERS.map((render) => render(data, opts)).filter(
    (lines) => lines.length > 0,
  );
  if (sections.length === 0) return undefined;

  const out: string[] = [];
  let used = 0;
  for (const lines of sections) {
    for (const line of lines) {
      const cost = line.length + 1;
      if (used + cost > MAX_BIKE_CONTEXT_CHARS - TRUNCATION_MARKER.length) {
        out.push(TRUNCATION_MARKER);
        return out.join('\n');
      }
      out.push(line);
      used += cost;
    }
  }
  return out.join('\n');
}
