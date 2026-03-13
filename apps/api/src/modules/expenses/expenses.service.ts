import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { Expense } from './models/expense.model';
import type { ExpenseCategory, ExpenseSummary } from './models/expense-summary.model';

@Injectable()
export class ExpensesService {
  private readonly logger = new Logger(ExpensesService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async findByMotorcycle(
    userId: string,
    motorcycleId: string,
    year?: number,
  ): Promise<ExpenseSummary> {
    this.logger.debug(
      `findByMotorcycle: userId=${userId}, motorcycleId=${motorcycleId}, year=${year}`,
    );

    let query = this.supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    // year=0 or undefined means "all time"; otherwise filter to that year
    if (year && year > 0) {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      query = query.gte('date', yearStart).lte('date', yearEnd);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`findByMotorcycle failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch expenses');
    }

    const rows = (data ?? []).map((row) => this.mapRow(row));

    // Group by category
    const categoryMap = new Map<string, Expense[]>();
    for (const expense of rows) {
      const existing = categoryMap.get(expense.category) ?? [];
      existing.push(expense);
      categoryMap.set(expense.category, existing);
    }

    const categories: ExpenseCategory[] = [];
    let ytdTotal = 0;

    for (const [category, expenses] of categoryMap) {
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      ytdTotal += total;
      categories.push({ category, total, expenses });
    }

    return { ytdTotal, categories };
  }

  async create(
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
      `create: userId=${userId}, motorcycleId=${input.motorcycleId}, amount=${input.amount}, category=${input.category}`,
    );

    const { data, error } = await this.supabase
      .from('expenses')
      .insert({
        user_id: userId,
        motorcycle_id: input.motorcycleId,
        amount: input.amount,
        category: input.category,
        date: input.date,
        description: input.description,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`create failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to create expense');
    }
    return this.mapRow(data);
  }

  async softDelete(userId: string, id: string): Promise<boolean> {
    this.logger.log(`softDelete: userId=${userId}, expenseId=${id}`);

    const { data, error } = await this.supabase
      .from('expenses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`softDelete failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to delete expense');
    }
    return true;
  }

  async createFromTask(
    userId: string,
    motorcycleId: string,
    taskId: string,
    amount: number,
    taskTitle: string,
  ): Promise<Expense | null> {
    this.logger.log(`createFromTask: userId=${userId}, taskId=${taskId}, amount=${amount}`);

    const { data, error } = await this.supabase
      .from('expenses')
      .insert({
        user_id: userId,
        motorcycle_id: motorcycleId,
        amount,
        category: 'maintenance',
        date: new Date().toISOString().split('T')[0],
        description: taskTitle,
        maintenance_task_id: taskId,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (duplicate maintenance_task_id) gracefully
      if (error.code === '23505') {
        this.logger.warn(`createFromTask: duplicate expense for taskId=${taskId}, skipping`);
        return null;
      }
      this.logger.error(`createFromTask failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to create expense from task');
    }

    return data ? this.mapRow(data) : null;
  }

  private mapRow(row: Record<string, unknown>): Expense {
    return {
      id: row.id as string,
      motorcycleId: row.motorcycle_id as string,
      amount: row.amount as number,
      category: row.category as string,
      date: row.date as string,
      description: (row.description as string) ?? undefined,
      maintenanceTaskId: (row.maintenance_task_id as string) ?? undefined,
      createdAt: row.created_at as string,
    };
  }
}
