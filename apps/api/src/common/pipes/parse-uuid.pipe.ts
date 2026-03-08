import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

export const ParseUUIDPipe = new ZodValidationPipe(z.string().uuid());
