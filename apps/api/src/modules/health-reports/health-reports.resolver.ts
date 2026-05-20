import { GenerateHealthReportInputSchema } from '@motovault/types';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { GenerateReportInput } from './dto/generate-report.input';
import { HealthReportsService } from './health-reports.service';
import { HealthReport } from './models/health-report.model';

@Resolver(() => HealthReport)
export class HealthReportsResolver {
  constructor(private readonly healthReportsService: HealthReportsService) {}

  @Mutation(() => HealthReport)
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
