import { AddExpensePhotoSchema, LogExpenseSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AddExpensePhotoInput } from './dto/add-expense-photo.input';
import { LogExpenseInput } from './dto/log-expense.input';
import { ExpensesService } from './expenses.service';
import { Expense } from './models/expense.model';
import { ExpenseDashboardSummary } from './models/expense-dashboard.model';
import { ExpensePhoto } from './models/expense-photo.model';
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

  @Query(() => ExpenseDashboardSummary)
  @UseGuards(GqlAuthGuard)
  async expenseDashboard(
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ExpenseDashboardSummary> {
    return this.expensesService.getDashboard(user.id, motorcycleId);
  }

  @Query(() => [ExpensePhoto])
  @UseGuards(GqlAuthGuard)
  async expensePhotos(
    @CurrentUser() user: AuthUser,
    @Args('expenseId', ParseUUIDPipe) expenseId: string,
  ): Promise<ExpensePhoto[]> {
    return this.expensesService.findPhotosByExpenseId(user.id, expenseId);
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

  // ==========================================
  // Expense photo mutations (MOT-143)
  // ==========================================

  @Mutation(() => ExpensePhoto)
  @UseGuards(GqlAuthGuard)
  async addExpensePhoto(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(AddExpensePhotoSchema))
    input: AddExpensePhotoInput,
  ): Promise<ExpensePhoto> {
    return this.expensesService.addPhoto(
      user.id,
      input.expenseId,
      input.storagePath,
      input.fileSizeBytes,
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteExpensePhoto(
    @CurrentUser() user: AuthUser,
    @Args('photoId', ParseUUIDPipe) photoId: string,
  ): Promise<boolean> {
    return this.expensesService.deletePhoto(user.id, photoId);
  }

  @ResolveField(() => [ExpensePhoto])
  @UseGuards(GqlAuthGuard)
  async photos(
    @CurrentUser() user: AuthUser,
    @Parent() expense: Expense,
  ): Promise<ExpensePhoto[]> {
    // TODO todo-107: Replace with DataLoader to batch photo fetches across a
    // list query to avoid N+1 when listing many expenses with photos.
    return this.expensesService.findPhotosByExpenseId(user.id, expense.id);
  }
}
