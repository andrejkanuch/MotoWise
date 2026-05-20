import { ForbiddenException } from '@nestjs/common';
import { Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiBudgetService } from './ai-budget.service';
import { AiBudgetStatus } from './models/ai-budget-status.model';

@Resolver()
export class AiBudgetResolver {
  constructor(private readonly aiBudgetService: AiBudgetService) {}

  @Query(() => AiBudgetStatus)
  async aiBudgetStatus(@CurrentUser() user: AuthUser): Promise<AiBudgetStatus> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return this.aiBudgetService.getBudgetStatus();
  }

  @Mutation(() => Boolean)
  async resetAiCircuitBreaker(@CurrentUser() user: AuthUser): Promise<boolean> {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    await this.aiBudgetService.resetCircuitBreaker();
    return true;
  }
}
