import { MaintenanceServiceType } from '../constants/enums';

/**
 * Classify a free-text maintenance/service label into a canonical
 * {@link MaintenanceServiceType}. Deterministic and dependency-free: it powers
 * both scanned receipt line items and normalization of the free-text
 * `oem_maintenance_schedules.task_name` catalog, so the two join on a stable
 * type instead of fuzzy string matching.
 *
 * Cross-language by design — dealer invoices are localized (the reference
 * corpus is a Spanish Honda invoice), so keyword sets carry English + Spanish
 * terms. Matching is accent- and case-insensitive (input is normalized to
 * lowercase ASCII first), so keywords are written without diacritics.
 *
 * Order matters: rules are evaluated top-to-bottom and the first hit wins, so
 * more specific operations (a DCT/transmission oil change, a fork oil, an oil
 * FILTER) are checked before the broad "oil" rule that would otherwise swallow
 * them. Unknown/illegible labels fall through to OTHER (never throws).
 */

interface ClassifierRule {
  readonly type: MaintenanceServiceType;
  readonly keywords: readonly string[];
}

/** First matching rule wins — keep specific operations above the broad "oil" rule. */
const CLASSIFIER_RULES: readonly ClassifierRule[] = [
  {
    type: MaintenanceServiceType.BRAKE_FLUID,
    keywords: ['brake fluid', 'dot 4', 'dot4', 'dot 3', 'dot3', 'liquido de frenos'],
  },
  {
    type: MaintenanceServiceType.BRAKE_PADS,
    keywords: ['brake pad', 'pads inspection', 'pastilla', 'brake lock'],
  },
  { type: MaintenanceServiceType.FORK_OIL, keywords: ['fork oil', 'fork', 'horquilla'] },
  { type: MaintenanceServiceType.FINAL_DRIVE, keywords: ['final drive', 'cardan', 'shaft drive'] },
  {
    type: MaintenanceServiceType.TRANSMISSION_OIL,
    keywords: ['dct', 'transmission', 'gearbox', 'primary', 'chaincase', 'caja de cambios'],
  },
  {
    type: MaintenanceServiceType.COOLANT,
    keywords: ['coolant', 'refrigerante', 'anticongelante', 'radiator', 'radiador'],
  },
  {
    type: MaintenanceServiceType.VALVE_CLEARANCE,
    keywords: ['valve', 'valvula', 'desmo', 'cam chain'],
  },
  {
    type: MaintenanceServiceType.AIR_FILTER,
    keywords: ['air filter', 'air cleaner', 'filtro de aire', 'filtro aire'],
  },
  { type: MaintenanceServiceType.SPARK_PLUG, keywords: ['spark plug', 'bujia'] },
  { type: MaintenanceServiceType.CHAIN, keywords: ['chain', 'cadena'] },
  { type: MaintenanceServiceType.TIRE, keywords: ['tire', 'tyre', 'neumatico', 'rueda'] },
  { type: MaintenanceServiceType.BELT, keywords: ['belt', 'correa', 'cvt'] },
  { type: MaintenanceServiceType.BATTERY, keywords: ['battery', 'bateria'] },
  // Combined "oil & filter change" schedule item → treat as the oil change.
  {
    type: MaintenanceServiceType.OIL_CHANGE,
    keywords: ['oil & filter', 'oil and filter', 'oil&filter', 'aceite y filtro'],
  },
  // Standalone oil filter (incl. Spanish "filtro de aceite") — before the broad oil rule.
  {
    type: MaintenanceServiceType.OIL_FILTER,
    keywords: ['oil filter', 'filtro de aceite', 'engine oil filter'],
  },
  {
    type: MaintenanceServiceType.OIL_CHANGE,
    keywords: ['oil change', 'engine oil', 'oil', 'aceite'],
  },
  {
    type: MaintenanceServiceType.GENERAL_SERVICE,
    keywords: [
      'service',
      'revision',
      'mantenimiento',
      'mano de obra',
      'labor',
      'inspection',
      'maintenance',
    ],
  },
];

/** Lowercase + strip diacritics so accented input matches the ASCII keyword sets. */
function normalize(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .trim();
}

/**
 * Map a free-text service/part label to a canonical {@link MaintenanceServiceType}.
 * Returns {@link MaintenanceServiceType.OTHER} for blank, unrecognized, or
 * illegible input. Never throws.
 */
export function classifyServiceType(label: string | null | undefined): MaintenanceServiceType {
  if (!label) return MaintenanceServiceType.OTHER;
  const text = normalize(label);
  if (!text) return MaintenanceServiceType.OTHER;

  for (const rule of CLASSIFIER_RULES) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      return rule.type;
    }
  }
  return MaintenanceServiceType.OTHER;
}
