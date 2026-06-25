import { DocumentsByMotorcycleDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { isExpiringSoon } from '../lib/document-expiry';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

/**
 * Per-bike document list + derived signals (count, expiring count), keyed on the
 * shared `documents.byMotorcycle` query so every consumer (the bike-detail entry
 * card and the full DocumentsSection) reads one cache entry / one network request.
 * The expiring rule comes from {@link isExpiringSoon} so it can't drift from badges.
 */
export function useMotorcycleDocuments(motorcycleId: string) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.documents.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(DocumentsByMotorcycleDocument, { motorcycleId }),
    select: (d) => ({
      documents: d.documents,
      count: d.documents.length,
      expiringCount: d.documents.filter((doc) => isExpiringSoon(doc.expiryDate)).length,
    }),
  });

  return {
    documents: data?.documents ?? [],
    count: data?.count ?? 0,
    expiringCount: data?.expiringCount ?? 0,
    isLoading,
  };
}
