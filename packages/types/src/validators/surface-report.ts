import { z } from 'zod';

// --- Surface Conditions ---

export const SURFACE_CONDITIONS = {
  SMOOTH: 'smooth',
  ROUGH: 'rough',
  GRAVEL: 'gravel',
  POTHOLES: 'potholes',
  WET: 'wet',
  ICY: 'icy',
  DEBRIS: 'debris',
  CONSTRUCTION: 'construction',
} as const;

export const SurfaceConditionSchema = z.enum([
  'smooth',
  'rough',
  'gravel',
  'potholes',
  'wet',
  'icy',
  'debris',
  'construction',
]);

export type SurfaceCondition = z.infer<typeof SurfaceConditionSchema>;

// --- Report Surface Input ---

export const ReportSurfaceInputSchema = z.object({
  routeId: z.string().uuid(),
  condition: SurfaceConditionSchema,
  note: z.string().max(500).optional(),
  photoUrl: z.string().url().optional(),
});

export type ReportSurfaceInput = z.infer<typeof ReportSurfaceInputSchema>;
