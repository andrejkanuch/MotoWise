import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { ExpensesService } from './expenses.service';
import type { ExpensePhoto } from './models/expense-photo.model';

@Injectable({ scope: Scope.REQUEST })
export class ExpensePhotosLoader {
  private readonly loader: DataLoader<string, ExpensePhoto[]>;

  constructor(private readonly expensesService: ExpensesService) {
    this.loader = new DataLoader<string, ExpensePhoto[]>(async (expenseIds) => {
      const map = await this.expensesService.findPhotosByExpenseIds([...expenseIds]);
      return expenseIds.map((id) => map.get(id) ?? []);
    });
  }

  load(expenseId: string): Promise<ExpensePhoto[]> {
    return this.loader.load(expenseId);
  }
}
