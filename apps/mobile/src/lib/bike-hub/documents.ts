import type { DocumentCategoriesQuery, DocumentsByMotorcycleQuery } from '@motovault/graphql';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  DUE_SOON_DAYS,
  RIDE_BLOCKING_DOCUMENT_CATEGORIES,
  SEEDED_CATEGORY_KIND,
} from './constants';

type Document = DocumentsByMotorcycleQuery['documents'][number];
type Category = DocumentCategoriesQuery['documentCategories'][number];

export type HubDocumentInput = Pick<Document, 'id' | 'title' | 'categoryId' | 'expiryDate'>;
export type HubCategoryInput = Pick<Category, 'id' | 'name' | 'kind'>;

/** A document whose expiry has passed or falls inside the due-soon window. */
export interface DocumentSignal<D extends HubDocumentInput = HubDocumentInput> {
  document: D;
  /** Category name as stored (seeded names are canonical English keys); `null` when unresolved. */
  categoryName: string | null;
  /** True for a seeded category in the riding-blocking list (D2). */
  blocksRiding: boolean;
  expired: boolean;
  /** Whole calendar days until expiry (when not expired) or since it (when expired). */
  days: number;
}

const BLOCKING_NAMES: readonly string[] = RIDE_BLOCKING_DOCUMENT_CATEGORIES;

function blocksRiding(category: HubCategoryInput | undefined): boolean {
  if (!category) return false;
  return category.kind === SEEDED_CATEGORY_KIND && BLOCKING_NAMES.includes(category.name);
}

/**
 * Documents that are expired or expire within `DUE_SOON_DAYS`, most urgent first
 * (expired before expiring, then by days). Documents without an expiry date are
 * never a signal.
 */
export function getDocumentSignals<D extends HubDocumentInput>(
  documents: readonly D[],
  categories: readonly HubCategoryInput[],
  today: Date,
): DocumentSignal<D>[] {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const signals: DocumentSignal<D>[] = [];
  for (const document of documents) {
    if (!document.expiryDate) continue;
    const days = differenceInCalendarDays(parseISO(document.expiryDate), today);
    if (Number.isNaN(days) || days > DUE_SOON_DAYS) continue;
    const category = categoryById.get(document.categoryId);
    signals.push({
      document,
      categoryName: category?.name ?? null,
      blocksRiding: blocksRiding(category),
      expired: days < 0,
      days: Math.abs(days),
    });
  }
  // Signed days: expired documents are negative, so they sort first.
  const signed = (signal: DocumentSignal<D>): number =>
    signal.expired ? -signal.days : signal.days;
  return signals.sort((a, b) => signed(a) - signed(b));
}
