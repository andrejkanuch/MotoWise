import { z } from 'zod';
import { SponsorshipPlacementType, SponsorshipStatus } from '../constants/enums';

const statuses = Object.values(SponsorshipStatus) as [string, ...string[]];
const placementTypes = Object.values(SponsorshipPlacementType) as [string, ...string[]];

export const SponsorshipSchema = z.object({
  id: z.string().uuid(),
  sponsorId: z.string().uuid(),
  routeId: z.string().uuid(),
  placementType: z.enum(placementTypes),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
  ctaText: z.string().max(100).nullable().optional(),
  ctaUrl: z.string().url().max(2048).nullable().optional(),
  impressionsCount: z.number().int().min(0),
  clicksCount: z.number().int().min(0),
  status: z.enum(statuses),
  costPerImpression: z.number().min(0),
  monthlyBudget: z.number().min(0),
  spentThisMonth: z.number().min(0),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Sponsorship = z.infer<typeof SponsorshipSchema>;

export const TrackSponsorshipImpressionInputSchema = z.object({
  sponsorshipId: z.string().uuid(),
});
export type TrackSponsorshipImpressionInput = z.infer<typeof TrackSponsorshipImpressionInputSchema>;

export const TrackSponsorshipClickInputSchema = z.object({
  sponsorshipId: z.string().uuid(),
});
export type TrackSponsorshipClickInput = z.infer<typeof TrackSponsorshipClickInputSchema>;
