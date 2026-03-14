import { MotorcycleModelsDocument } from '@motovault/graphql';
import { MotorcycleType } from '@motovault/types';
import { useQuery } from '@tanstack/react-query';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

export function detectTypeFromModel(modelName: string): MotorcycleType | null {
  const lower = modelName.toLowerCase();
  if (/ninja|cbr|yzf-r|gsxr|gsx-r|zx|rc\d|panigale|rsv|daytona/i.test(lower))
    return MotorcycleType.SPORTBIKE;
  if (/vulcan|shadow|rebel|scout|sportster|fatboy|softail|dyna|iron\s?\d/i.test(lower))
    return MotorcycleType.CRUISER;
  if (/goldwing|gold wing|electra|road king|road glide|voyager|k\s?1600/i.test(lower))
    return MotorcycleType.TOURING;
  if (/dr-z|drz|klx|crf|wr\d|xr\d|rally|tenere|versys|v-strom|vstrom|tiger|adventure/i.test(lower))
    return MotorcycleType.DUAL_SPORT;
  if (/crf\d+f|yz\d+f|kx\d+|rm-z|rmz|tc\d|fc\d|sx|exc/i.test(lower))
    return MotorcycleType.DIRT_BIKE;
  if (/scooter|vespa|pcx|nmax|xmax|burgman|forza|metropolitan|scoopy/i.test(lower))
    return MotorcycleType.SCOOTER;
  return null;
}

export function useMotorcycleModels(makeId: number, year: number, search: string) {
  const modelsResult = useQuery({
    queryKey: queryKeys.nhtsa.models({ makeId, year }),
    queryFn: () => gqlFetcher(MotorcycleModelsDocument, { makeId, year }),
    enabled: makeId > 0 && year > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const models = modelsResult.data?.motorcycleModels ?? [];
  const filteredModels =
    search.length > 0
      ? models.filter((m) => m.modelName.toLowerCase().includes(search.toLowerCase()))
      : models;

  return {
    models,
    filteredModels,
    isLoading: modelsResult.isLoading,
    isError: modelsResult.isError,
    isSuccess: modelsResult.isSuccess,
    refetch: modelsResult.refetch,
  };
}
