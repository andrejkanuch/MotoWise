import { ReportSurfaceInputSchema } from '@motovault/types/validators';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReportSurfaceInput } from './dto/report-surface.input';
import { RouteConditions, SurfaceReport } from './models/surface-report.model';
import { SurfaceReportsService } from './surface-reports.service';

@Resolver(() => SurfaceReport)
@UseGuards(GqlAuthGuard)
export class SurfaceReportsResolver {
  constructor(private readonly surfaceReportsService: SurfaceReportsService) {}

  @Mutation(() => SurfaceReport)
  async reportSurface(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(ReportSurfaceInputSchema))
    input: ReportSurfaceInput,
  ): Promise<SurfaceReport> {
    return this.surfaceReportsService.reportSurface(user.id, input);
  }

  @Query(() => RouteConditions)
  @Public()
  async routeConditions(
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<RouteConditions> {
    return this.surfaceReportsService.routeConditions(routeId);
  }
}
