import { CreateDiagnosticSchema, SubmitDiagnosticSchema } from '@motovault/types';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MotorcyclesService } from '../motorcycles/motorcycles.service';
import { DiagnosticAiService } from './diagnostic-ai.service';
import { DiagnosticsService } from './diagnostics.service';
import { CreateDiagnosticInput } from './dto/create-diagnostic.input';
import { SubmitDiagnosticInput } from './dto/submit-diagnostic.input';
import { Diagnostic } from './models/diagnostic.model';

@Resolver(() => Diagnostic)
export class DiagnosticsResolver {
  constructor(
    private readonly diagnosticsService: DiagnosticsService,
    private readonly diagnosticAiService: DiagnosticAiService,
    private readonly motorcyclesService: MotorcyclesService,
  ) {}

  @Query(() => [Diagnostic])
  @UseGuards(GqlAuthGuard)
  async myDiagnostics(@CurrentUser() user: AuthUser): Promise<Diagnostic[]> {
    return this.diagnosticsService.findByUser(user.id);
  }

  @Query(() => Diagnostic, { nullable: true })
  @UseGuards(GqlAuthGuard)
  async diagnosticById(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<Diagnostic | null> {
    return this.diagnosticsService.findById(user.id, id);
  }

  @Mutation(() => Diagnostic)
  @UseGuards(GqlAuthGuard)
  async createDiagnostic(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateDiagnosticSchema)) input: CreateDiagnosticInput,
  ): Promise<Diagnostic> {
    return this.diagnosticsService.create(user.id, input);
  }

  @Mutation(() => Diagnostic)
  @UseGuards(GqlAuthGuard)
  @Throttle({ ai: { ttl: 60000, limit: 3 } })
  async submitDiagnostic(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(SubmitDiagnosticSchema)) input: SubmitDiagnosticInput,
  ): Promise<Diagnostic> {
    // 1. Create diagnostic record with processing status
    const diagnostic = await this.diagnosticsService.create(user.id, {
      motorcycleId: input.motorcycleId,
      wizardAnswers: input.wizardAnswers,
      dataSharingOptedIn: input.dataSharingOptedIn,
      description: input.description,
    });

    // 2. Fetch motorcycle details for context
    const motorcycles = await this.motorcyclesService.findByUser(user.id);
    const motorcycle = motorcycles.find((m) => m.id === input.motorcycleId);
    if (!motorcycle) {
      throw new BadRequestException('Motorcycle not found');
    }

    // 3. Run AI analysis
    await this.diagnosticAiService.analyze(diagnostic.id, input.photoBase64, {
      make: motorcycle.make,
      model: motorcycle.model,
      year: motorcycle.year,
      description: input.description,
      wizardAnswers: input.wizardAnswers,
    });

    // 4. Return the updated diagnostic
    const updated = await this.diagnosticsService.findById(user.id, diagnostic.id);
    if (!updated) {
      throw new BadRequestException('Failed to retrieve diagnostic after analysis');
    }
    return updated;
  }
}
