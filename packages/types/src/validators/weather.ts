import { z } from 'zod';

export const WeatherForecastInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type WeatherForecastInput = z.infer<typeof WeatherForecastInputSchema>;
