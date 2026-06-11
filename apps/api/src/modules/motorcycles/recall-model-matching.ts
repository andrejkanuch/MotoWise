/**
 * NHTSA's recall database and its vPIC vehicle database use DIFFERENT model
 * names for the same motorcycle: vPIC (which feeds the onboarding bike picker)
 * carries marketing names — "Africa Twin", "Street Glide", "Star Venture" —
 * while recall campaigns are filed under homologation codes — "CRF1100",
 * "FLHX", "XV1900". A recallsByVehicle query with the vPIC name returns zero
 * campaigns, falsely telling riders their bike has no open recalls.
 *
 * Two complementary strategies close the gap:
 * 1. Generic matching: expand the stored name (parenthetical splits like
 *    "VT750 (Shadow Aero 750)") and match it against the recall-side model
 *    list for the same make/year via normalized containment + token overlap.
 * 2. RECALL_MODEL_ALIASES: curated marketing-name → code pairs that no string
 *    matching can bridge (GOLD WING ↔ GL1800). A wrong or stale alias is
 *    harmless — the extra query just returns zero rows.
 */

/** Shortest substring allowed to count as a containment match ("PCX" ⊂ "PCX150"). */
const MIN_CONTAINMENT_LENGTH = 3;
/** Token overlap needed when neither name contains the other. */
const MIN_SHARED_TOKENS = 2;
/** Hard cap on recallsByVehicle queries per lookup. */
const MAX_CANDIDATES = 8;

/**
 * Marketing name (as stored from vPIC / free text) → recall-database codes.
 * Keyed by `MAKE|MODEL`, both uppercased with collapsed whitespace.
 * Codes were verified against api.nhtsa.gov/products/vehicle/models?issueType=r
 * where possible; unverifiable entries only cost an empty extra query.
 */
export const RECALL_MODEL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  // Honda
  'HONDA|GOLD WING': ['GL1800'],
  // recallsByVehicle matches filed names near-exactly: Honda filed Africa Twin
  // campaigns under BOTH "CRF1100L" (20V797000) and "CRF1100" (24V882000,
  // 25V583000) — the L-suffixed and bare codes return disjoint campaign sets.
  'HONDA|AFRICA TWIN': ['CRF1100L', 'CRF1000L', 'CRF1100', 'CRF1000'],
  'HONDA|AFRICA TWIN ADVENTURE SPORTS': ['CRF1100L', 'CRF1000L', 'CRF1100', 'CRF1000'],
  'HONDA|REBEL 300': ['CMX300'],
  'HONDA|REBEL 500': ['CMX500'],
  'HONDA|REBEL 1100': ['CMX1100'],
  'HONDA|GROM': ['MSX125'],
  'HONDA|MONKEY': ['Z125'],
  'HONDA|SHADOW AERO': ['VT750'],
  'HONDA|SHADOW PHANTOM': ['VT750'],
  // Yamaha
  'YAMAHA|STAR VENTURE': ['XV1900'],
  'YAMAHA|STAR ELUDER': ['XV1900'],
  'YAMAHA|V STAR 650': ['XVS650'],
  'YAMAHA|V STAR 950': ['XVS950'],
  'YAMAHA|V STAR 1100': ['XVS1100'],
  'YAMAHA|V STAR 1300': ['XVS1300'],
  'YAMAHA|SUPER TENERE': ['XT1200Z'],
  'YAMAHA|TENERE 700': ['XTZ690', 'XTZ700'],
  // Harley-Davidson — recalls are filed under FL/FX/XL/RH codes
  'HARLEY-DAVIDSON|STREET GLIDE': ['FLHX'],
  'HARLEY-DAVIDSON|STREET GLIDE SPECIAL': ['FLHXS'],
  'HARLEY-DAVIDSON|STREET GLIDE ST': ['FLHXST'],
  'HARLEY-DAVIDSON|ROAD GLIDE': ['FLTRX'],
  'HARLEY-DAVIDSON|ROAD GLIDE SPECIAL': ['FLTRXS'],
  'HARLEY-DAVIDSON|ROAD GLIDE LIMITED': ['FLTRK'],
  'HARLEY-DAVIDSON|ROAD GLIDE ST': ['FLTRXST'],
  'HARLEY-DAVIDSON|ROAD KING': ['FLHR'],
  'HARLEY-DAVIDSON|ROAD KING SPECIAL': ['FLHRXS'],
  'HARLEY-DAVIDSON|ULTRA LIMITED': ['FLHTK'],
  'HARLEY-DAVIDSON|TRI GLIDE ULTRA': ['FLHTCUTG'],
  'HARLEY-DAVIDSON|FREEWHEELER': ['FLRT'],
  'HARLEY-DAVIDSON|STREET BOB': ['FXBB'],
  'HARLEY-DAVIDSON|FAT BOB': ['FXFB', 'FXFBS'],
  'HARLEY-DAVIDSON|FAT BOY': ['FLFB', 'FLFBS'],
  'HARLEY-DAVIDSON|BREAKOUT': ['FXBR', 'FXBRS'],
  'HARLEY-DAVIDSON|HERITAGE CLASSIC': ['FLHC', 'FLHCS'],
  'HARLEY-DAVIDSON|SOFTAIL SLIM': ['FLSL'],
  'HARLEY-DAVIDSON|DELUXE': ['FLDE'],
  'HARLEY-DAVIDSON|SPORT GLIDE': ['FLSB'],
  'HARLEY-DAVIDSON|LOW RIDER': ['FXLR'],
  'HARLEY-DAVIDSON|LOW RIDER S': ['FXLRS'],
  'HARLEY-DAVIDSON|LOW RIDER ST': ['FXLRST'],
  'HARLEY-DAVIDSON|IRON 883': ['XL883N'],
  'HARLEY-DAVIDSON|IRON 1200': ['XL1200NS'],
  'HARLEY-DAVIDSON|FORTY-EIGHT': ['XL1200X'],
  'HARLEY-DAVIDSON|PAN AMERICA': ['RA1250', 'RA1250S'],
  'HARLEY-DAVIDSON|SPORTSTER S': ['RH1250S'],
  'HARLEY-DAVIDSON|NIGHTSTER': ['RH975'],
};

/** Uppercase + collapse whitespace runs — alias-table key normalization. */
function normalizeName(name: string): string {
  return name.toUpperCase().replace(/\s+/g, ' ').trim();
}

export function aliasKey(make: string, model: string): string {
  return `${normalizeName(make)}|${normalizeName(model)}`;
}

/** Strip everything except letters/digits — spacing- and punctuation-blind form. */
function spaceless(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Split into letter-runs and digit-runs: "CRF1100 AFRICA TWIN" → CRF,1100,AFRICA,TWIN */
function tokensOf(name: string): Set<string> {
  return new Set(name.toUpperCase().match(/[A-Z]+|\d+/g) ?? []);
}

/**
 * Do two model names plausibly refer to the same bike?
 * - containment on the punctuation-blind form ("R 1250 GS" ⊂ "R1250GS",
 *   "AFRICA TWIN" ⊂ "CRF1100 AFRICA TWIN"), or
 * - ≥2 shared tokens ("Africa Twin Adventure Sports" ∩ "CRF1100 AFRICA TWIN").
 */
export function isModelNameMatch(a: string, b: string): boolean {
  const aFlat = spaceless(a);
  const bFlat = spaceless(b);
  if (!aFlat || !bFlat) return false;

  const [shorter, longer] = aFlat.length <= bFlat.length ? [aFlat, bFlat] : [bFlat, aFlat];
  if (shorter.length >= MIN_CONTAINMENT_LENGTH && longer.includes(shorter)) return true;

  const bTokens = tokensOf(b);
  let shared = 0;
  for (const token of tokensOf(a)) {
    if (bTokens.has(token)) shared++;
  }
  return shared >= MIN_SHARED_TOKENS;
}

/**
 * Model-name candidates to query recallsByVehicle with, best-first:
 * the stored name, parenthetical parts ("NPS50 (Ruckus)" → "NPS50", "Ruckus"),
 * curated aliases, then recall-side names matched via isModelNameMatch.
 * Deduplicated on the punctuation-blind form, capped at MAX_CANDIDATES.
 */
export function buildCandidateModels(
  make: string,
  model: string,
  recallSideModels: readonly string[],
): string[] {
  const primaries = [model];
  const paren = model.match(/^([^(]+)\(([^)]+)\)/);
  if (paren) primaries.push(paren[1].trim(), paren[2].trim());

  const aliases = RECALL_MODEL_ALIASES[aliasKey(make, model)] ?? [];
  const probes = [...primaries, ...aliases];
  const matched = recallSideModels.filter((rs) => probes.some((p) => isModelNameMatch(p, rs)));

  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const candidate of [...probes, ...matched]) {
    const key = spaceless(candidate);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }
  return candidates.slice(0, MAX_CANDIDATES);
}
