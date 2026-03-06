import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../constants/enums';

export const SupportedLocaleSchema = z.enum(SUPPORTED_LOCALES);
