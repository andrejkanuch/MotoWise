import { z } from 'zod';

export const PLACE_KINDS = {
  COUNTRY: 'country',
  REGION: 'region',
  CITY: 'city',
} as const;

export const PlaceKindSchema = z.enum(['country', 'region', 'city']);
export type PlaceKind = z.infer<typeof PlaceKindSchema>;

export const PlaceSchema = z.object({
  id: z.number(),
  kind: PlaceKindSchema,
  name: z.string(),
  countryCode: z.string().min(2).max(2),
  regionCode: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  population: z.number().default(0),
});
export type Place = z.infer<typeof PlaceSchema>;
