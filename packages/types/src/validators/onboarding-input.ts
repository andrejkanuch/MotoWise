import { z } from 'zod';
import {
  AnnualRepairSpend,
  ExperienceLevel,
  LastServiceDate,
  LearningFormat,
  MaintenanceStyle,
  MotorcycleType,
  ReminderChannel,
  RidingFrequency,
  RidingGoal,
} from '../constants/enums';

const experienceLevelValues = Object.values(ExperienceLevel) as [string, ...string[]];
const ridingGoalValues = Object.values(RidingGoal) as [string, ...string[]];
const ridingFrequencyValues = Object.values(RidingFrequency) as [string, ...string[]];
const maintenanceStyleValues = Object.values(MaintenanceStyle) as [string, ...string[]];
const learningFormatValues = Object.values(LearningFormat) as [string, ...string[]];
const motorcycleTypeValues = Object.values(MotorcycleType) as [string, ...string[]];
const annualRepairSpendValues = Object.values(AnnualRepairSpend) as [string, ...string[]];
const lastServiceDateValues = Object.values(LastServiceDate) as [string, ...string[]];
const reminderChannelValues = Object.values(ReminderChannel) as [string, ...string[]];

export const CompleteOnboardingInputSchema = z.object({
  experienceLevel: z.enum(experienceLevelValues),
  ridingGoals: z.array(z.enum(ridingGoalValues)).min(0),
  ridingFrequency: z.enum(ridingFrequencyValues).optional(),
  maintenanceStyle: z.enum(maintenanceStyleValues).optional(),
  learningFormats: z.array(z.enum(learningFormatValues)).max(4),
  annualRepairSpend: z.enum(annualRepairSpendValues).optional(),
  reminderChannel: z.enum(reminderChannelValues).optional(),
  lastServiceDate: z.enum(lastServiceDateValues).optional(),
  maintenanceReminders: z.boolean().optional().default(true),
  seasonalTips: z.boolean().optional().default(false),
  recallAlerts: z.boolean().optional().default(false),
  weeklySummary: z.boolean().optional().default(false),
  bikeMake: z.string().min(1).max(100).optional(),
  bikeModel: z.string().min(1).max(100).optional(),
  bikeYear: z.number().int().min(1900).max(2030).optional(),
  bikeType: z.enum(motorcycleTypeValues).optional(),
  bikeMileage: z.number().int().min(0).max(999999).optional(),
  bikeNickname: z.string().max(50).optional(),
  bikePhotoUrl: z.string().url().max(500).optional(),
  bikeMileageUnit: z.enum(['mi', 'km']).optional(),
});

export type CompleteOnboardingInput = z.infer<typeof CompleteOnboardingInputSchema>;
