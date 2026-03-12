import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { AiBudgetService } from './ai-budget.service';
import { AiBudgetStatus } from './models/ai-budget-status.model';

@Resolver()
export class AiBudgetResolver {
  constructor(private readonly aiBudgetService: AiBudgetService) {}

  @Query(() => AiBudgetStatus)
  @UseGuards(GqlAuthGuard)
  async aiBudgetStatus(@CurrentUser() user: AuthUser): Promise<AiBudgetStatus> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return this.aiBudgetService.getBudgetStatus();
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async resetAiCircuitBreaker(@CurrentUser() user: AuthUser): Promise<boolean> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    this.aiBudgetService.resetCircuitBreaker();
    return true;
  }
}
