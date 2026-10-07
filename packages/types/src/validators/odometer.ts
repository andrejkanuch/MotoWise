import { z } from 'zod';
import { ODOMETER_FUTURE_TOLERANCE_MS, ODOMETER_MAX } from '../constants/limits';

export const LogOdometerReadingSchema = z.object({
  motorcycleId: z.string().uuid(),
  /** Raw value in the bike's distance unit. May be lower than the current one. */
  value: z.number().int().min(0).max(ODOMETER_MAX),
  /** When the value was read. Omitted = now. Back-dating is allowed. */
  recordedAt: z
    .string()
    .datetime({ offset: true })
    .refine((value) => Date.parse(value) <= Date.now() + ODOMETER_FUTURE_TOLERANCE_MS, {
      message: 'recordedAt cannot be in the future',
    })
    .optional(),
});
export type LogOdometerReading = z.infer<typeof LogOdometerReadingSchema>;
