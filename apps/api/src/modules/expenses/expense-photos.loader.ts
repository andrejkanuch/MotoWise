import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { ExpensesService } from './expenses.service';
import type { ExpensePhoto } from './models/expense-photo.model';

@Injectable({ scope: Scope.REQUEST })
export class ExpensePhotosLoader {
  private readonly loader: DataLoader<string, ExpensePhoto[]>;
  // Request-scoped: every load in a request is for the same authenticated user,
  // so capturing the uid from load() and using it in the batch fn is safe. It is
  // the C1 ownership anchor for receipts signed-URL resolution (U7a / KTD-2).
  private ownerUserId: string | null = null;

  constructor(private readonly expensesService: ExpensesService) {
    this.loader = new DataLoader<string, ExpensePhoto[]>(async (expenseIds) => {
      const map = await this.expensesService.findPhotosByExpenseIds(
        [...expenseIds],
        this.ownerUserId ?? '',
      );
      return expenseIds.map((id) => map.get(id) ?? []);
    });
  }

  load(expenseId: string, ownerUserId: string): Promise<ExpensePhoto[]> {
    this.ownerUserId = ownerUserId;
    return this.loader.load(expenseId);
  }
}
