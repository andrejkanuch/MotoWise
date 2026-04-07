import { z } from 'zod';
import { AffiliatePartner } from '../constants/enums';

const partners = Object.values(AffiliatePartner) as [string, ...string[]];

export const TrackAffiliateClickInputSchema = z.object({
  partner: z.enum(partners),
  productUrl: z.string().url().max(2048),
  diagnosisType: z.string().max(100).optional(),
  diagnosisId: z.string().uuid().optional(),
});
export type TrackAffiliateClickInput = z.infer<typeof TrackAffiliateClickInputSchema>;
