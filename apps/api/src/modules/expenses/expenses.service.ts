import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { Expense } from './models/expense.model';
import type { ExpenseSummary } from './models/expense-summary.model';

const EXPENSE_CATEGORIES = ['fuel', 'maintenance', 'parts', 'gear'] as const;

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async getExpenses(userId: string, motorcycleId: string, year: number): Promise<ExpenseSummary> {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    const { data, error } = await this.supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .order('date', { ascending: false });

    if (error) {
      this.logger.error(`getExpenses failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch expenses');
    }

    const rows = (data ?? []).map((row) => this.mapRow(row));
    const ytdTotal = rows.reduce((sum, e) => sum + e.amount, 0);

    const categories = EXPENSE_CATEGORIES.map((category) => {
      const categoryExpenses = rows.filter((e) => e.category === category);
      return {
        category,
        total: categoryExpenses.reduce((sum, e) => sum + e.amount, 0),
        expenses: categoryExpenses,
      };
    });

    return { ytdTotal, categories };
  }

  async logExpense(
    userId: string,
    input: {
      motorcycleId: string;
      amount: number;
      category: string;
      date: string;
      description?: string;
    },
  ): Promise<Expense> {
    this.logger.log(
      `logExpense: userId=${userId}, motorcycleId=${input.motorcycleId}, amount=${input.amount}, category=${input.category}`,
    );

    // Verify motorcycle belongs to user
    const { data: bike, error: bikeError } = await this.supabase
      .from('motorcycles')
      .select('id')
      .eq('id', input.motorcycleId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (bikeError || !bike) {
      throw new BadRequestException('Motorcycle not found');
    }

    const { data, error } = await this.supabase
      .from('expenses')
      .insert({
        user_id: userId,
        motorcycle_id: input.motorcycleId,
        amount: input.amount,
        category: input.category,
        date: input.date,
        description: input.description ?? null,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`logExpense failed: ${error?.message}`);
      throw new BadRequestException('Failed to log expense');
    }
    return this.mapRow(data);
  }

  async updateExpense(
    userId: string,
    id: string,
    input: {
      amount?: number;
      category?: string;
      date?: string;
      description?: string;
    },
  ): Promise<Expense> {
    this.logger.log(`updateExpense: userId=${userId}, expenseId=${id}`);

    const updates: Record<string, unknown> = {};
    if (input.amount !== undefined) updates.amount = input.amount;
    if (input.category !== undefined) updates.category = input.category;
    if (input.date !== undefined) updates.date = input.date;
    if (input.description !== undefined) updates.description = input.description;

    const { data, error } = await this.supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`updateExpense failed: ${error?.message}`);
      throw new BadRequestException('Failed to update expense');
    }
    return this.mapRow(data);
  }

  async deleteExpense(userId: string, id: string): Promise<boolean> {
    this.logger.log(`deleteExpense: userId=${userId}, expenseId=${id}`);

    const { data, error } = await this.supabase.rpc('soft_delete_expense', {
      expense_id: id,
    });

    if (error) {
      this.logger.error(`deleteExpense failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to delete expense');
    }
    if (data === false) {
      throw new NotFoundException('Expense not found');
    }
    return true;
  }

  private mapRow(row: Record<string, unknown>): Expense {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      motorcycleId: row.motorcycle_id as string,
      amount: Number(row.amount),
      category: row.category as string,
      description: (row.description as string) ?? undefined,
      date: row.date as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}
