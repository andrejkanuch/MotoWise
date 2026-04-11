import { GenerateHealthReportInputSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { GenerateReportInput } from './dto/generate-report.input';
import { HealthReportsService } from './health-reports.service';
import { HealthReport } from './models/health-report.model';

@Resolver(() => HealthReport)
@UseGuards(GqlAuthGuard)
export class HealthReportsResolver {
  constructor(private readonly healthReportsService: HealthReportsService) {}

  @Mutation(() => HealthReport)
  @Throttle({ default: THROTTLE_PRESETS.HEALTH_REPORT })
  async generateBikeHealthReport(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(GenerateHealthReportInputSchema))
    input: GenerateReportInput,
  ): Promise<HealthReport> {
    return this.healthReportsService.generateReport(user.id, input.bikeId);
  }

  @Query(() => [HealthReport])
  async getMyHealthReports(@CurrentUser() user: AuthUser): Promise<HealthReport[]> {
    return this.healthReportsService.getMyReports(user.id);
  }
}
