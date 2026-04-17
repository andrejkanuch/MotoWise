import { z } from 'zod';
import {
  ParticipantRoleSchema,
  PeriodOfDaySchema,
  TripSuggestionDecisionSchema,
  TripSuggestionKindSchema,
} from './trip';

// --- Create Trip Suggestion ---

export const CreateTripSuggestionInputSchema = z
  .object({
    tripId: z.string().uuid(),
    kind: TripSuggestionKindSchema.default('waypoint'),
    name: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(2000).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    dayIndex: z.number().int().min(0).max(60).optional(),
    periodOfDay: PeriodOfDaySchema.optional(),
  })
  .superRefine((data, ctx) => {
    // Waypoint suggestions must include coordinates — the service enforces the
    // same rule but surfacing it here gives the client a clean field-level
    // error instead of a generic BadRequest.
    if (data.kind === 'waypoint') {
      if (data.lat == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Waypoint suggestions require lat',
          path: ['lat'],
        });
      }
      if (data.lng == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Waypoint suggestions require lng',
          path: ['lng'],
        });
      }
    }
  });

export type CreateTripSuggestionInput = z.infer<typeof CreateTripSuggestionInputSchema>;

// --- Respond To Trip Suggestion ---

export const RespondToTripSuggestionInputSchema = z.object({
  suggestionId: z.string().uuid(),
  decision: TripSuggestionDecisionSchema,
  note: z.string().trim().max(1000).optional(),
});

export type RespondToTripSuggestionInput = z.infer<typeof RespondToTripSuggestionInputSchema>;

// --- Set Trip Participant Role ---

// Organisers can only promote to co_planner or demote back to rider through
// this API. The organiser themself is protected at the service layer.
export const SetTripParticipantRoleInputSchema = z.object({
  tripId: z.string().uuid(),
  userId: z.string().uuid(),
  role: ParticipantRoleSchema.refine((r) => r === 'co_planner' || r === 'rider', {
    message: 'Role must be co_planner or rider',
  }),
});

export type SetTripParticipantRoleInput = z.infer<typeof SetTripParticipantRoleInputSchema>;
