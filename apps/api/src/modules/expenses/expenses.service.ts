import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { Expense } from './models/expense.model';
import type {
  CategoryTotal,
  ExpenseDashboardSummary,
  MonthlyBucket,
} from './models/expense-dashboard.model';
import type { ExpensePhoto } from './models/expense-photo.model';
import type { ExpenseCategory, ExpenseSummary } from './models/expense-summary.model';

const MAX_PHOTOS_PER_EXPENSE = 3;

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
  private readonly supabaseUrl: string;

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    configService: ConfigService,
  ) {
    this.supabaseUrl = configService.get<string>('SUPABASE_URL') ?? '';
  }

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
      this.logger.error(
        `softDelete failed: ${error?.message} (code=${error?.code}, details=${error?.details}, hint=${error?.hint})`,
      );
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

    // Look up user's currency preference so task-generated expenses match manual ones
    const { data: userRow } = await this.supabase
      .from('users')
      .select('currency')
      .eq('id', userId)
      .single();

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
        ...(userRow?.currency && { currency: userRow.currency }),
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
        tires: Math.round((categories.tires ?? 0) * 100) / 100,
        insurance: Math.round((categories.insurance ?? 0) * 100) / 100,
        registration: Math.round((categories.registration ?? 0) * 100) / 100,
        tolls: Math.round((categories.tolls ?? 0) * 100) / 100,
        parking: Math.round((categories.parking ?? 0) * 100) / 100,
        modifications: Math.round((categories.modifications ?? 0) * 100) / 100,
        training: Math.round((categories.training ?? 0) * 100) / 100,
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

  // ==========================================
  // Expense Photos (MOT-143)
  // ==========================================

  async addPhoto(
    userId: string,
    expenseId: string,
    storagePath: string,
    fileSizeBytes?: number,
  ): Promise<ExpensePhoto> {
    this.logger.log(`addPhoto: userId=${userId}, expenseId=${expenseId}`);

    // Verify expense ownership
    const { data: expense, error: expenseError } = await this.adminClient
      .from('expenses')
      .select('id')
      .eq('id', expenseId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (expenseError || !expense) {
      throw new NotFoundException('Expense not found');
    }

    // Check photo count limit
    const { count, error: countError } = await this.adminClient
      .from('expense_photos')
      .select('id', { count: 'exact', head: true })
      .eq('expense_id', expenseId);

    if (countError) throw new InternalServerErrorException('Failed to check photo count');
    if ((count ?? 0) >= MAX_PHOTOS_PER_EXPENSE) {
      throw new BadRequestException(`Maximum of ${MAX_PHOTOS_PER_EXPENSE} photos per expense`);
    }

    // Determine mime type from storage path
    const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'webp';
    const mimeMap: Record<string, string> = {
      webp: 'image/webp',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      heic: 'image/heic',
    };
    const mimeType = mimeMap[ext] ?? 'image/webp';

    const { data, error } = await this.adminClient
      .from('expense_photos')
      .insert({
        expense_id: expenseId,
        user_id: userId,
        storage_path: storagePath,
        file_size_bytes: fileSizeBytes ?? null,
        mime_type: mimeType,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`addPhoto failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to add photo');
    }
    return this.mapPhotoRow(data);
  }

  async deletePhoto(userId: string, photoId: string): Promise<boolean> {
    this.logger.log(`deletePhoto: userId=${userId}, photoId=${photoId}`);

    const { data: photo, error: photoError } = await this.adminClient
      .from('expense_photos')
      .select('id, expense_id, user_id, storage_path')
      .eq('id', photoId)
      .single();

    if (photoError || !photo) throw new NotFoundException('Photo not found');
    if (photo.user_id !== userId) throw new NotFoundException('Photo not found');

    // Delete from storage (best-effort)
    const { error: storageError } = await this.adminClient.storage
      .from('maintenance-photos')
      .remove([photo.storage_path]);

    if (storageError) {
      this.logger.warn(
        `deletePhoto: storage deletion failed for ${photo.storage_path}: ${storageError.message}`,
      );
    }

    const { error: deleteError } = await this.adminClient
      .from('expense_photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) throw new InternalServerErrorException('Failed to delete photo');
    return true;
  }

  async findPhotosByExpenseIds(expenseIds: string[]): Promise<Map<string, ExpensePhoto[]>> {
    if (expenseIds.length === 0) return new Map();

    const { data, error } = await this.adminClient
      .from('expense_photos')
      .select('*')
      .in('expense_id', expenseIds)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to fetch photos');

    const map = new Map<string, ExpensePhoto[]>();
    for (const expenseId of expenseIds) {
      map.set(expenseId, []);
    }
    for (const row of data ?? []) {
      const expenseId = row.expense_id as string;
      const photos = map.get(expenseId) ?? [];
      photos.push(this.mapPhotoRow(row));
      map.set(expenseId, photos);
    }
    return map;
  }

  async findPhotosByExpenseId(expenseId: string): Promise<ExpensePhoto[]> {
    const { data, error } = await this.adminClient
      .from('expense_photos')
      .select('*')
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to fetch photos');
    return (data ?? []).map((row) => this.mapPhotoRow(row));
  }

  private mapPhotoRow(row: Record<string, unknown>): ExpensePhoto {
    const storagePath = row.storage_path as string;
    return {
      id: row.id as string,
      expenseId: row.expense_id as string,
      storagePath,
      publicUrl: `${this.supabaseUrl}/storage/v1/object/public/maintenance-photos/${storagePath}`,
      fileSizeBytes: (row.file_size_bytes as number) ?? undefined,
      mimeType: (row.mime_type as string) ?? 'image/webp',
      createdAt: row.created_at as string,
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
