import { MotorcycleMakesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

const POPULAR_MAKES = [
  'Honda',
  'Yamaha',
  'Kawasaki',
  'Harley-Davidson',
  'Suzuki',
  'BMW',
  'Ducati',
  'KTM',
];

export function useMotorcycleMakes(search: string) {
  const makesResult = useQuery({
    queryKey: queryKeys.nhtsa.makes,
    queryFn: () => gqlFetcher(MotorcycleMakesDocument),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const makes = makesResult.data?.motorcycleMakes ?? [];

  const popularMakes = makes.filter((m) =>
    POPULAR_MAKES.some((p) => p.toLowerCase() === m.makeName.toLowerCase()),
  );

  const filteredMakes =
    search.length > 0
      ? makes.filter((make) => make.makeName.toLowerCase().includes(search.toLowerCase()))
      : [];

  return {
    makes,
    popularMakes,
    filteredMakes,
    isLoading: makesResult.isLoading,
    isError: makesResult.isError,
    refetch: makesResult.refetch,
  };
}
