import { z } from 'zod';
import { DiagnosticSeverity, MotorcycleType, URGENCY_VALUES } from '../constants/enums';
import { MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH } from '../constants/limits';

const severities = Object.values(DiagnosticSeverity) as [string, ...string[]];
const motorcycleTypes = Object.values(MotorcycleType) as [string, ...string[]];

export const DiagnosticIssueSchema = z.object({
  description: z.string(),
  probability: z.number().min(0).max(1),
});
export type DiagnosticIssue = z.infer<typeof DiagnosticIssueSchema>;

export const DiagnosticResultSchema = z.object({
  part: z.string(),
  description: z.string(),
  issues: z.array(DiagnosticIssueSchema),
  severity: z.enum(severities),
  toolsNeeded: z.array(z.string()),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'professional']),
  nextSteps: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  relatedArticleId: z.string().uuid().nullable(),
});
export type DiagnosticResult = z.infer<typeof DiagnosticResultSchema>;

export const CreateDiagnosticSchema = z.object({
  motorcycleId: z.string().uuid().optional(),
  wizardAnswers: z
    .object({
      symptoms: z.string().max(200).optional(),
      location: z.string().max(200).optional(),
      timing: z.string().max(200).optional(),
    })
    .optional(),
  dataSharingOptedIn: z.boolean().default(false),
});
export type CreateDiagnostic = z.infer<typeof CreateDiagnosticSchema>;

const safeTextRegex = /^[a-zA-Z0-9\s\-'./()]+$/;

export const ManualBikeInfoSchema = z.object({
  type: z.enum(motorcycleTypes),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 2)
    .optional(),
  make: z.string().max(100).regex(safeTextRegex, 'Invalid characters in make').optional(),
  model: z.string().max(100).regex(safeTextRegex, 'Invalid characters in model').optional(),
});
export type ManualBikeInfo = z.infer<typeof ManualBikeInfoSchema>;

export const SubmitDiagnosticSchema = z
  .object({
    motorcycleId: z.string().uuid().optional(),
    photoBase64: z
      .string()
      .min(100)
      .max(MAX_DIAGNOSTIC_IMAGE_BASE64_LENGTH, 'Image exceeds maximum size of 5 MB')
      .optional(),
    manualBikeInfo: ManualBikeInfoSchema.optional(),
    freeTextDescription: z.string().max(1000).optional(),
    additionalNotes: z.string().max(500).optional(),
    urgency: z.enum(URGENCY_VALUES).optional(),
    wizardAnswers: z
      .object({
        symptoms: z.string().max(200).optional(),
        location: z.string().max(200).optional(),
        timing: z.string().max(200).optional(),
      })
      .optional(),
    dataSharingOptedIn: z.boolean().default(false),
  })
  .refine((data) => data.motorcycleId || data.manualBikeInfo?.type, {
    message: 'Either motorcycleId or manualBikeInfo.type is required',
    path: ['motorcycleId'],
  })
  .refine(
    (data) => {
      const hasPhoto = !!data.photoBase64;
      const hasFreeText = !!data.freeTextDescription?.trim();
      const hasNotes = !!data.additionalNotes?.trim();
      const hasWizard =
        !!data.wizardAnswers?.symptoms?.trim() ||
        !!data.wizardAnswers?.location?.trim() ||
        !!data.wizardAnswers?.timing?.trim();
      return hasPhoto || hasFreeText || hasNotes || hasWizard;
    },
    {
      message:
        'At least one of photo, freeTextDescription, additionalNotes, or wizard answers is required',
      path: ['photoBase64'],
    },
  );
export type SubmitDiagnostic = z.infer<typeof SubmitDiagnosticSchema>;
