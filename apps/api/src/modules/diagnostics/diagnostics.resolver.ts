import {
  CreateDiagnosticSchema,
  MeasurementSystem,
  mileageUnitLabel,
  SubmitDiagnosticSchema,
} from '@motovault/types';
import { BadRequestException, Logger, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { AI_CONTENT_TYPES, AiBudgetService } from '../ai-budget/ai-budget.service';
import type { Motorcycle } from '../motorcycles/models/motorcycle.model';
import { MotorcyclesService } from '../motorcycles/motorcycles.service';
import { UsersService } from '../users/users.service';
import { DiagnosticAiService } from './diagnostic-ai.service';
import { DiagnosticContextBuilder, resolveBikeContextScope } from './diagnostic-context.builder';
import { DiagnosticsService } from './diagnostics.service';
import { CreateDiagnosticInput } from './dto/create-diagnostic.input';
import { SubmitDiagnosticInput } from './dto/submit-diagnostic.input';
import { Diagnostic } from './models/diagnostic.model';
import { DiagnosticQuota } from './models/diagnostic-quota.model';

@Resolver(() => Diagnostic)
export class DiagnosticsResolver {
  private readonly logger = new Logger(DiagnosticsResolver.name);

  constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly diagnosticAiService: DiagnosticAiService,
    private readonly motorcyclesService: MotorcyclesService,
    private readonly diagnosticContextBuilder: DiagnosticContextBuilder,
    private readonly usersService: UsersService,
    private readonly aiBudgetService: AiBudgetService,
  ) {}

  @Query(() => [Diagnostic])
  async myDiagnostics(@CurrentUser() user: AuthUser): Promise<Diagnostic[]> {
    return this.diagnosticsService.findByUser(user.id);
  }

  @Query(() => DiagnosticQuota)
  async diagnosticQuota(@CurrentUser() user: AuthUser): Promise<DiagnosticQuota> {
    return this.aiBudgetService.getFeatureUsage(user.id, AI_CONTENT_TYPES.DIAGNOSTIC);
  }

  @Query(() => Diagnostic, { nullable: true })
  async diagnosticById(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<Diagnostic | null> {
    return this.diagnosticsService.findById(user.id, id);
  }

  @Mutation(() => Diagnostic)
  async createDiagnostic(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateDiagnosticSchema)) input: CreateDiagnosticInput,
  ): Promise<Diagnostic> {
    return this.diagnosticsService.create(user.id, input);
  }

  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.AI_DIAGNOSTIC })
  @Mutation(() => Diagnostic)
  async submitDiagnostic(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(SubmitDiagnosticSchema)) input: SubmitDiagnosticInput,
  ): Promise<Diagnostic> {
    // Log ids/flags only — freeTextDescription/additionalNotes/wizardAnswers are PII
    this.logger.log(
      `[submitDiagnostic] input received: ${JSON.stringify({
        motorcycleId: input.motorcycleId,
        hasPhoto: !!input.photoBase64,
        urgency: input.urgency,
        includeMaintenanceHistory: input.includeMaintenanceHistory,
        includeBikeHistory: input.includeBikeHistory,
      })}`,
    );

    // 0. Server-side monthly diagnostic limit check (free tier only; counts
    // successful generations in content_generation_log)
    await this.aiBudgetService.enforceFeatureLimit(user.id, AI_CONTENT_TYPES.DIAGNOSTIC);

    const userRecord = await this.usersService.findById(user.id);

    // 1. Create diagnostic record with processing status
    const diagnostic = await this.diagnosticsService.create(user.id, {
      motorcycleId: input.motorcycleId,
      wizardAnswers: input.wizardAnswers,
      dataSharingOptedIn: input.dataSharingOptedIn,
      freeTextDescription: input.freeTextDescription,
      additionalNotes: input.additionalNotes,
      urgency: input.urgency,
      manualBikeInfo: input.manualBikeInfo,
    });

    // 2. Build AI context from motorcycle or manual bike info.
    // Odometer values are stored RAW in the owner's measurement system — only
    // the unit label follows the global measurement system, never the
    // deprecated per-bike mileageUnit.
    const measurementSystem =
      (userRecord.measurementSystem as MeasurementSystem) ?? MeasurementSystem.METRIC;
    const mileageUnit = mileageUnitLabel(measurementSystem);

    let make: string | undefined;
    let model: string | undefined;
    let year: number | undefined;
    let motorcycleType: string | undefined;
    let mileage: number | undefined;
    let engineCc: number | undefined;
    let motorcycle: Motorcycle | null = null;

    if (input.motorcycleId) {
      // Fetch the one bike directly instead of pulling the whole garage to .find() it.
      motorcycle = await this.motorcyclesService.findById(user.id, input.motorcycleId);
      if (!motorcycle) {
        throw new BadRequestException('Motorcycle not found');
      }
      make = motorcycle.make;
      model = motorcycle.model;
      year = motorcycle.year;
      motorcycleType = motorcycle.type;
      mileage = motorcycle.currentMileage ?? undefined;
      engineCc = motorcycle.engineCc;
    } else if (input.manualBikeInfo) {
      make = input.manualBikeInfo.make;
      model = input.manualBikeInfo.model;
      year = input.manualBikeInfo.year;
      motorcycleType = input.manualBikeInfo.type;
    }

    // 2b. Per-bike history (services, open items, parts/mods, riding, notes,
    // earlier assessments) — only for a garage bike, only within the scope the
    // rider's toggle consented to. Bounded and best effort; see the builder.
    const bikeContextScope = resolveBikeContextScope(input);
    const bikeContext =
      motorcycle && bikeContextScope
        ? await this.diagnosticContextBuilder.build({
            userId: user.id,
            motorcycleId: motorcycle.id,
            currentDiagnosticId: diagnostic.id,
            scope: bikeContextScope,
            measurementSystem,
            currentMileage: motorcycle.currentMileage,
            profile: {
              variant: motorcycle.variant,
              purchaseDate: motorcycle.purchaseDate,
              mileageUpdatedAt: motorcycle.mileageUpdatedAt,
            },
            symptoms: {
              location: input.wizardAnswers?.location,
              symptoms: input.wizardAnswers?.symptoms,
              freeTextDescription: input.freeTextDescription,
              additionalNotes: input.additionalNotes,
            },
          })
        : undefined;

    // 3. Fetch user preferences for AI enrichment
    const prefs = (userRecord.preferences ?? {}) as Record<string, unknown>;

    // 4. Run AI analysis
    await this.diagnosticAiService.analyze(diagnostic.id, user.id, input.photoBase64, {
      make,
      model,
      year,
      freeTextDescription: input.freeTextDescription,
      additionalNotes: input.additionalNotes,
      wizardAnswers: input.wizardAnswers,
      experienceLevel: prefs.experienceLevel as string | undefined,
      maintenanceStyle: prefs.maintenanceStyle as string | undefined,
      ridingFrequency: prefs.ridingFrequency as string | undefined,
      urgency: input.urgency,
      motorcycleType,
      mileage,
      mileageUnit,
      engineCc,
      hasPhoto: !!input.photoBase64,
      bikeContext,
    });

    // 5. Return the updated diagnostic
    const updated = await this.diagnosticsService.findById(user.id, diagnostic.id);
    if (!updated) {
      throw new BadRequestException('Failed to retrieve diagnostic after analysis');
    }
    return updated;
  }
}
