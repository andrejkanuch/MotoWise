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
import type {
  CategoryTotal,
  ExpenseDashboardSummary,
  MonthlyBucket,
} from './models/expense-dashboard.model';
import type { ExpenseCategory, ExpenseSummary } from './models/expense-summary.model';

/** Mirrors the selected columns from the expenses table (not yet in generated database.types.ts). */
interface ExpenseRow {
  id: string;
  user_id: string;
  motorcycle_id: string;
  amount: number | string; // DECIMAL comes back as string from Supabase
  category: string;
  currency: string;
  date: string;
  description: string | null;
  maintenance_task_id: string | null;
  created_at: string;
}

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

    // year=0 means "all time" (no year filter), so only validate positive years
    if (year !== undefined && year !== 0 && (year < 2000 || year > 2100)) {
      throw new BadRequestException('Year must be between 2000 and 2100');
    }

    let query = this.supabase
      .from('expenses')
      .select(
        'id, user_id, motorcycle_id, amount, category, currency, date, description, maintenance_task_id, created_at',
      )
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
      currency?: string;
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
        ...(input.currency && { currency: input.currency }),
      })
      .select(
        'id, user_id, motorcycle_id, amount, category, currency, date, description, maintenance_task_id, created_at',
      )
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
      .select('id')
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
      .select(
        'id, user_id, motorcycle_id, amount, category, currency, date, description, maintenance_task_id, created_at',
      )
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

  async getDashboard(userId: string, motorcycleId: string): Promise<ExpenseDashboardSummary> {
    this.logger.debug(`getDashboard: userId=${userId}, motorcycleId=${motorcycleId}`);

    const { data, error } = await this.supabase
      .from('expenses')
      .select('amount, category, date')
      .eq('user_id', userId)
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .limit(5000);

    if (error) {
      this.logger.error(`getDashboard failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch expense dashboard');
    }

    const rows = data ?? [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const previousYear = currentYear - 1;

    let currentYearTotal = 0;
    let previousYearTotal = 0;
    let allTimeTotal = 0;

    // month key → category → amount
    const bucketMap = new Map<string, Record<string, number>>();
    const categoryTotalMap = new Map<string, number>();

    for (const row of rows) {
      const amount = Math.round(Number(row.amount) * 100) / 100;
      const [yearStr, monthStr] = (row.date as string).split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);

      allTimeTotal += amount;
      if (year === currentYear) currentYearTotal += amount;
      if (year === previousYear) previousYearTotal += amount;

      // Monthly bucket
      const bucketKey = `${year}-${month}`;
      if (!bucketMap.has(bucketKey)) {
        bucketMap.set(bucketKey, {});
      }
      const bucket = bucketMap.get(bucketKey);
      if (bucket) {
        bucket[row.category] = (bucket[row.category] ?? 0) + amount;
      }

      // Category total
      categoryTotalMap.set(row.category, (categoryTotalMap.get(row.category) ?? 0) + amount);
    }

    // Build monthly buckets sorted by year desc, month desc
    const monthlyBuckets: MonthlyBucket[] = [];
    for (const [key, categories] of bucketMap) {
      const [yearStr, monthStr] = key.split('-');
      monthlyBuckets.push({
        year: Number(yearStr),
        month: Number(monthStr),
        fuel: Math.round((categories.fuel ?? 0) * 100) / 100,
        maintenance: Math.round((categories.maintenance ?? 0) * 100) / 100,
        parts: Math.round((categories.parts ?? 0) * 100) / 100,
        gear: Math.round((categories.gear ?? 0) * 100) / 100,
        total: Math.round(Object.values(categories).reduce((sum, v) => sum + v, 0) * 100) / 100,
      });
    }
    monthlyBuckets.sort((a, b) => b.year - a.year || b.month - a.month);

    // Build category totals
    const categoryTotals: CategoryTotal[] = [];
    for (const [category, total] of categoryTotalMap) {
      categoryTotals.push({
        category,
        total: Math.round(total * 100) / 100,
      });
    }
    categoryTotals.sort((a, b) => b.total - a.total);

    return {
      currentYearTotal: Math.round(currentYearTotal * 100) / 100,
      previousYearTotal: Math.round(previousYearTotal * 100) / 100,
      allTimeTotal: Math.round(allTimeTotal * 100) / 100,
      expenseCount: rows.length,
      monthlyBuckets,
      categoryTotals,
    };
  }

  private mapRow(row: ExpenseRow): Expense {
    return {
      id: row.id,
      motorcycleId: row.motorcycle_id,
      amount: Math.round(Number(row.amount) * 100) / 100,
      category: row.category,
      currency: row.currency ?? 'USD',
      date: row.date,
      description: row.description ?? undefined,
      maintenanceTaskId: row.maintenance_task_id ?? undefined,
      createdAt: row.created_at,
    };
  }
}
