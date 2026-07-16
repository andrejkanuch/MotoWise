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
import { MaintenanceTasksService } from '../maintenance-tasks/maintenance-tasks.service';
import { MotorcyclesService } from '../motorcycles/motorcycles.service';
import { UsersService } from '../users/users.service';
import { DiagnosticAiService } from './diagnostic-ai.service';
import { DiagnosticsService } from './diagnostics.service';
import { CreateDiagnosticInput } from './dto/create-diagnostic.input';
import { SubmitDiagnosticInput } from './dto/submit-diagnostic.input';
import { Diagnostic } from './models/diagnostic.model';

@Resolver(() => Diagnostic)
export class DiagnosticsResolver {
  private readonly logger = new Logger(DiagnosticsResolver.name);

  constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly diagnosticAiService: DiagnosticAiService,
    private readonly motorcyclesService: MotorcyclesService,
    private readonly maintenanceTasksService: MaintenanceTasksService,
    private readonly usersService: UsersService,
    private readonly aiBudgetService: AiBudgetService,
  ) {}

  @Query(() => [Diagnostic])
  async myDiagnostics(@CurrentUser() user: AuthUser): Promise<Diagnostic[]> {
    return this.diagnosticsService.findByUser(user.id);
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

    if (input.motorcycleId) {
      // Fetch the one bike directly instead of pulling the whole garage to .find() it.
      const motorcycle = await this.motorcyclesService.findById(user.id, input.motorcycleId);
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

    // 2b. Fetch maintenance history if user opted in and motorcycle is from garage
    const MAX_MAINTENANCE_HISTORY_TASKS = 30;
    let maintenanceHistory: string | undefined;
    if (input.includeMaintenanceHistory && input.motorcycleId) {
      const tasks = await this.maintenanceTasksService.findAllHistory(
        user.id,
        input.motorcycleId,
        MAX_MAINTENANCE_HISTORY_TASKS,
      );
      if (tasks.length > 0) {
        const unit = mileageUnit;
        const sanitize = (text: string) =>
          text.replace(/[<>]/g, '').replace(/\n/g, ' ').trim().slice(0, 200);
        maintenanceHistory = tasks
          .map((task) => {
            const parts = [sanitize(task.title)];
            if (task.status === 'completed' && task.completedAt) {
              parts.push(`completed ${task.completedAt.split('T')[0]}`);
            } else {
              parts.push(`status: ${task.status}`);
            }
            if (task.completedMileage != null) parts.push(`at ${task.completedMileage} ${unit}`);
            return `- ${parts.join(' | ')}`;
          })
          .join('\n');
      }
    }

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
      maintenanceHistory,
    });

    // 5. Return the updated diagnostic
    const updated = await this.diagnosticsService.findById(user.id, diagnostic.id);
    if (!updated) {
      throw new BadRequestException('Failed to retrieve diagnostic after analysis');
    }
    return updated;
  }
}
