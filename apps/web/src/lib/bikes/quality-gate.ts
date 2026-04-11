import type { BikePageData } from './bike-data';

/**
 * Result of scoring a single bike page against the corpus.
 *
 * A page is eligible for indexing (`passes === true`) only if:
 *   - `wordCount >= 500`
 *   - `uniquenessRatio >= 0.4`  (measured as `1 - maxSiblingJaccard`)
 *   - `dataPointCount >= 5`
 *
 * For MVP the Jaccard similarity is computed in-place over 5-gram word shingles.
 * This is O(n·m) in corpus size and is fine for the current fixture count.
 *
 * TODO: swap to MinHash/LSH when corpus > 1000 pages.
 */
export interface QualityResult {
  passes: boolean;
  reasons: string[];
  wordCount: number;
  uniquenessRatio: number;
  dataPointCount: number;
}

const SHINGLE_SIZE = 5;

function tokenize(body: string): string[] {
  return body
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(body: string, size = SHINGLE_SIZE): Set<string> {
  const tokens = tokenize(body);
  const out = new Set<string>();
  if (tokens.length < size) {
    if (tokens.length > 0) out.add(tokens.join(' '));
    return out;
  }
  for (let i = 0; i <= tokens.length - size; i++) {
    out.add(tokens.slice(i, i + size).join(' '));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const shingle of a) {
    if (b.has(shingle)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function bodyOf(data: BikePageData): string {
  return data.bodyParagraphs.join(' ');
}

function wordCountOf(data: BikePageData): number {
  return bodyOf(data).split(/\s+/).filter(Boolean).length;
}

function pageKey(data: BikePageData): string {
  return `${data.makeSlug}/${data.modelSlug}/${data.year}/${data.pageType}`;
}

export function scoreBikePage(data: BikePageData, corpus: readonly BikePageData[]): QualityResult {
  const wordCount = wordCountOf(data);
  const dataPointCount = data.specs.length + (data.telemetry?.length ?? 0);

  const selfShingles = shingles(bodyOf(data));
  const selfKey = pageKey(data);

  let maxJaccard = 0;
  for (const other of corpus) {
    if (pageKey(other) === selfKey) continue;
    const otherShingles = shingles(bodyOf(other));
    const score = jaccard(selfShingles, otherShingles);
    if (score > maxJaccard) maxJaccard = score;
  }
  const uniquenessRatio = 1 - maxJaccard;

  const reasons: string[] = [];
  if (wordCount < 500) reasons.push(`wordCount ${wordCount} < 500`);
  if (uniquenessRatio < 0.4) {
    reasons.push(
      `uniquenessRatio ${uniquenessRatio.toFixed(3)} < 0.4 (maxSiblingJaccard ${maxJaccard.toFixed(3)})`,
    );
  }
  if (dataPointCount < 5) reasons.push(`dataPointCount ${dataPointCount} < 5`);

  return {
    passes: reasons.length === 0,
    reasons,
    wordCount,
    uniquenessRatio,
    dataPointCount,
  };
}
