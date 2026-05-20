import { CreateDiagnosticSchema, FREE_TIER_LIMITS, SubmitDiagnosticSchema } from '@motovault/types';
import { BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
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

  @Mutation(() => Diagnostic)
  async submitDiagnostic(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(SubmitDiagnosticSchema)) input: SubmitDiagnosticInput,
  ): Promise<Diagnostic> {
    this.logger.log(
      `[submitDiagnostic] input received: ${JSON.stringify({
        ...input,
        photoBase64: input.photoBase64 ? `[base64 ${input.photoBase64.length} chars]` : undefined,
      })}`,
    );

    // 0. Server-side monthly diagnostic limit check
    const userRecord = await this.usersService.findById(user.id);
    const tier = (userRecord.subscriptionTier as 'free' | 'pro') ?? 'free';
    if (tier === 'free') {
      const monthCount = await this.diagnosticsService.countUserDiagnosticsThisMonth(user.id);
      if (monthCount >= FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH) {
        throw new ForbiddenException(
          `Free plan allows ${FREE_TIER_LIMITS.MAX_AI_DIAGNOSTICS_PER_MONTH} AI diagnostics per month. Upgrade to Pro for unlimited diagnostics.`,
        );
      }
    }

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

    // 2. Build AI context from motorcycle or manual bike info
    let make: string | undefined;
    let model: string | undefined;
    let year: number | undefined;
    let motorcycleType: string | undefined;
    let mileage: number | undefined;
    let mileageUnit: string | undefined;
    let engineCc: number | undefined;

    if (input.motorcycleId) {
      const motorcycles = await this.motorcyclesService.findByUser(user.id);
      const motorcycle = motorcycles.find((m) => m.id === input.motorcycleId);
      if (!motorcycle) {
        throw new BadRequestException('Motorcycle not found');
      }
      make = motorcycle.make;
      model = motorcycle.model;
      year = motorcycle.year;
      motorcycleType = motorcycle.type;
      mileage = motorcycle.currentMileage;
      mileageUnit = motorcycle.mileageUnit;
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
        const unit = mileageUnit ?? 'km';
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
