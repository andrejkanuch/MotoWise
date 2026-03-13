import { LogExpenseSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { LogExpenseInput } from './dto/log-expense.input';
import { ExpensesService } from './expenses.service';
import { Expense } from './models/expense.model';
import { ExpenseSummary } from './models/expense-summary.model';

@Resolver(() => Expense)
export class ExpensesResolver {
  constructor(private readonly expensesService: ExpensesService) {}

  @Query(() => ExpenseSummary)
  @UseGuards(GqlAuthGuard)
  async expenses(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
    @Args('year', { type: () => Int, nullable: true }) year?: number,
  ): Promise<ExpenseSummary> {
    return this.expensesService.findByMotorcycle(user.id, motorcycleId, year);
  }

  @Mutation(() => Expense)
  @UseGuards(GqlAuthGuard)
  async logExpense(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(LogExpenseSchema)) input: LogExpenseInput,
  ): Promise<Expense> {
    return this.expensesService.create(user.id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteExpense(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<boolean> {
    return this.expensesService.softDelete(user.id, id);
  }
}
