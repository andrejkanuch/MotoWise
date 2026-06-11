import { z } from 'zod';
import {
  AnnualRepairSpend,
  Currency,
  ExperienceLevel,
  LastServiceDate,
  LearningFormat,
  MaintenanceStyle,
  MotorcycleType,
  ReminderChannel,
  RidingFrequency,
  RidingGoal,
} from '../constants/enums';
import { MotorcycleMakeSchema } from './motorcycle';
import { nullishToUndefined } from './nullish';

const experienceLevelValues = Object.values(ExperienceLevel) as [string, ...string[]];
const ridingGoalValues = Object.values(RidingGoal) as [string, ...string[]];
const ridingFrequencyValues = Object.values(RidingFrequency) as [string, ...string[]];
const maintenanceStyleValues = Object.values(MaintenanceStyle) as [string, ...string[]];
const learningFormatValues = Object.values(LearningFormat) as [string, ...string[]];
const motorcycleTypeValues = Object.values(MotorcycleType) as [string, ...string[]];
const annualRepairSpendValues = Object.values(AnnualRepairSpend) as [string, ...string[]];
const lastServiceDateValues = Object.values(LastServiceDate) as [string, ...string[]];
const reminderChannelValues = Object.values(ReminderChannel) as [string, ...string[]];
const currencyValues = Object.values(Currency) as [string, ...string[]];

export const CompleteOnboardingInputSchema = z.object({
  experienceLevel: z.enum(experienceLevelValues),
  ridingGoals: z.array(z.enum(ridingGoalValues)).min(0),
  ridingFrequency: nullishToUndefined(z.enum(ridingFrequencyValues)),
  maintenanceStyle: nullishToUndefined(z.enum(maintenanceStyleValues)),
  learningFormats: z.array(z.enum(learningFormatValues)).max(4),
  annualRepairSpend: nullishToUndefined(z.enum(annualRepairSpendValues)),
  reminderChannel: nullishToUndefined(z.enum(reminderChannelValues)),
  lastServiceDate: nullishToUndefined(z.enum(lastServiceDateValues)),
  maintenanceReminders: z.boolean().optional().default(true),
  seasonalTips: z.boolean().optional().default(false),
  recallAlerts: z.boolean().optional().default(false),
  weeklySummary: z.boolean().optional().default(false),
  bikeMake: nullishToUndefined(MotorcycleMakeSchema),
  bikeModel: nullishToUndefined(z.string().min(1).max(100)),
  bikeYear: nullishToUndefined(
    z
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear() + 2),
  ),
  bikeType: nullishToUndefined(z.enum(motorcycleTypeValues)),
  bikeMileage: nullishToUndefined(z.number().int().min(0).max(999999)),
  bikeNickname: nullishToUndefined(z.string().max(50)),
  bikePhotoUrl: nullishToUndefined(z.string().url().max(500)),
  /**
   * @deprecated The mileage unit is now derived from the user's global
   * `measurementSystem` preference, not stored per bike. Kept for backward
   * compatibility; new clients send the preference-derived unit.
   */
  bikeMileageUnit: nullishToUndefined(z.enum(['mi', 'km'])),
  acceptedOemScheduleIds: nullishToUndefined(z.array(z.string().uuid()).max(50)),
  currency: nullishToUndefined(z.enum(currencyValues)),
  fbclid: nullishToUndefined(z.string().max(256)),
  eventId: nullishToUndefined(z.string().uuid()),
});

export type CompleteOnboardingInput = z.infer<typeof CompleteOnboardingInputSchema>;
