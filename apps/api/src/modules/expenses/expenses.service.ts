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
import {
  deleteReceiptsPhotoObjects,
  PHOTO_BUCKETS,
  type PhotoStorageRow,
  photoBucketOf,
  resolvePhotoUrl,
} from '../../common/storage/photo-storage';
import { PG_ERROR, unwrap } from '../../common/supabase/unwrap';
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

/** Rounds a money value to 2 decimal places. */
function roundCurrency(value: number): number {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * Coerce a task's completedAt (a timestamptz string) to the DATE column's
 * `YYYY-MM-DD`, using the UTC calendar date so it matches how completedAt is
 * stored. Falls back to today for a null/unparseable value.
 */
function toExpenseDate(date?: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!date) return today;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? today : parsed.toISOString().slice(0, 10);
}

/** One month bucket as returned by the expense_dashboard_aggregates RPC. */
interface DashboardAggregateBucket {
  year: number;
  month: number;
  categories: Record<string, number> | null;
  total: number;
}

/** JSONB payload returned by the expense_dashboard_aggregates RPC. */
interface DashboardAggregateResult {
  currentYearTotal: number;
  previousYearTotal: number;
  allTimeTotal: number;
  expenseCount: number;
  monthlyBuckets: DashboardAggregateBucket[];
  categoryTotals: { category: string; total: number }[];
}

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
  item_name: string | null;
  maintenance_task_id: string | null;
  created_at: string;
}

/** Columns selected for an expense row. Keep in sync with the ExpenseRow interface. */
const EXPENSE_COLUMNS =
  'id, user_id, motorcycle_id, amount, category, currency, date, description, item_name, maintenance_task_id, created_at';

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
      .select(EXPENSE_COLUMNS)
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

    const result = await query;
    const data = unwrap(result, {
      logger: this.logger,
      op: 'findByMotorcycle',
      message: 'Failed to fetch expenses',
    });

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
      itemName?: string;
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
        item_name: input.itemName ?? null,
        ...(input.currency && { currency: input.currency }),
      })
      .select(EXPENSE_COLUMNS)
      .single();

    if (error || !data) {
      this.logger.error(`create failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to create expense');
    }
    return this.mapRow(data);
  }

  async softDelete(userId: string, id: string): Promise<boolean> {
    this.logger.log(`softDelete: userId=${userId}, expenseId=${id}`);

    // Goes through soft_delete_expense (00176), NOT a direct UPDATE, because a
    // direct UPDATE cannot work here at all. `Users read own expenses` is
    // `USING (auth.uid() = user_id AND deleted_at IS NULL)`, and PostgreSQL
    // applies SELECT policies to the NEW row of an UPDATE — so stamping
    // deleted_at makes the row invisible and the statement is rejected with
    // 42501 "new row violates row-level security policy". The table's own
    // UPDATE policy passes; the SELECT policy is what rejects it, which is why
    // 00053 relaxing the UPDATE WITH CHECK changed nothing. Expense deletion
    // failed for EVERY rider, not an unlucky few (MOTO-VAULT-REACT-NATIVE-1M:
    // 418 events, 14 users — that count is people tapping Delete over and over).
    //
    // The RPC is SECURITY DEFINER, so the SELECT policy does not apply to it,
    // and it pins `user_id = auth.uid()` internally — ownership stays in the
    // database rather than moving into an app-layer filter, which is what using
    // the service-role client here would have cost. See
    // docs/solutions/architecture/soft-delete-rejected-by-select-rls-policy.md.
    //
    // Returns true when the expense is deleted AND the caller's, including when
    // it was already deleted. That idempotence is deliberate: double-taps,
    // stale lists and sync retries all mean "make this gone", and the earlier
    // `.single()` treated them as PGRST116 errors (MOTO-VAULT-REACT-NATIVE-1J:
    // ~877 events, 10 users).
    const { data, error } = await this.supabase.rpc('soft_delete_expense', {
      expense_id: id,
    });

    if (error) {
      this.logger.error(
        `softDelete failed: ${error.message} (code=${error.code}, details=${error.details}, hint=${error.hint})`,
      );
      throw new BadRequestException('Failed to delete expense');
    }

    // No expense of theirs by that id. Report success anyway — the caller's
    // intent ("this should be gone") already holds, and saying otherwise would
    // also confirm whether an id exists on someone else's account.
    if (data === false) {
      this.logger.log(`softDelete: no expense matched id=${id} for this user — idempotent OK`);
      return true;
    }

    // R5/R10: a soft-deleted expense's private receipt objects must be purged
    // from storage (not just left behind an orphaned link row). Legacy public
    // photos are unaffected — the public bucket has its own lifecycle. Safe to
    // re-run on an already-deleted expense: the link rows are gone, so it
    // no-ops, and it reclaims anything a previous failed purge left behind.
    await this.purgeReceiptsPhotos(userId, id);
    return true;
  }

  /**
   * Removes the storage OBJECTS + link rows for any receipts-bucket photos
   * attached to an expense. Best-effort (logs, never throws): a failed object
   * delete must not resurrect the already soft-deleted expense.
   */
  private async purgeReceiptsPhotos(userId: string, expenseId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('expense_photos')
      .select('id, storage_path, bucket, user_id')
      .eq('expense_id', expenseId)
      .eq('user_id', userId)
      .eq('bucket', PHOTO_BUCKETS.RECEIPTS);

    if (error || !data || data.length === 0) return;

    const { removedPaths } = await deleteReceiptsPhotoObjects({
      rows: data as PhotoStorageRow[],
      ownerUserId: userId,
      adminClient: this.adminClient,
      logger: this.logger,
    });

    // Only drop link rows whose storage object was actually removed — a link for
    // an object that failed to delete is retained so the pair stays consistent
    // (avoids orphaning a private receipt object with no DB link to it).
    const removed = new Set(removedPaths);
    const idsToUnlink = data
      .filter((row) => removed.has(row.storage_path as string))
      .map((row) => row.id);
    if (idsToUnlink.length === 0) return;

    const { error: linkError } = await this.supabase
      .from('expense_photos')
      .delete()
      .in('id', idsToUnlink);
    if (linkError) {
      this.logger.warn(`purgeReceiptsPhotos: link-row delete failed: ${linkError.message}`);
    }
  }

  async createFromTask(
    userId: string,
    motorcycleId: string,
    taskId: string,
    amount: number,
    taskTitle: string,
    currency?: string,
    /** Service date (task completedAt). Defaults to today when absent. */
    date?: string | null,
  ): Promise<Expense | null> {
    this.logger.log(`createFromTask: userId=${userId}, taskId=${taskId}, amount=${amount}`);

    // Prefer the task's own currency (e.g. a scanned receipt's currency) so the
    // linked expense faithfully reflects what was paid. Only when the task has no
    // currency do we fall back to the user's profile preference so task-generated
    // expenses match manual ones. Admin client: `currency` is not in the
    // authenticated column grants (00141).
    let resolvedCurrency = currency;
    if (!resolvedCurrency) {
      const { data: userRow } = await this.adminClient
        .from('users')
        .select('currency')
        .eq('id', userId)
        .single();
      resolvedCurrency = userRow?.currency ?? undefined;
    }

    const { data, error } = await this.supabase
      .from('expenses')
      .insert({
        user_id: userId,
        motorcycle_id: motorcycleId,
        amount,
        category: 'maintenance',
        // Date on the service day (task completedAt), not "today". Slice the UTC
        // calendar date so a backdated/scanned invoice lands on its real date;
        // fall back to today when absent or unparseable.
        date: toExpenseDate(date),
        description: taskTitle,
        maintenance_task_id: taskId,
        ...(resolvedCurrency && { currency: resolvedCurrency }),
      })
      .select(EXPENSE_COLUMNS)
      .single();

    if (error) {
      // Handle unique constraint violation (duplicate maintenance_task_id) gracefully
      if (error.code === PG_ERROR.UNIQUE_VIOLATION) {
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

    // H10: aggregation runs in SQL (00147_expense_dashboard_aggregates). The old
    // path fetched a 5000-row slice with no ORDER BY and summed in JS — silently
    // wrong past 5000 expenses. The RPC scopes rows to auth.uid() internally
    // (SECURITY INVOKER + user client), so it needs only the motorcycle id.
    const rpcResult = await this.supabase.rpc('expense_dashboard_aggregates', {
      p_motorcycle_id: motorcycleId,
    });
    const data = unwrap(rpcResult, {
      logger: this.logger,
      op: 'getDashboard',
      message: 'Failed to fetch expense dashboard',
    });

    const result = (data ?? {}) as DashboardAggregateResult;

    const monthlyBuckets: MonthlyBucket[] = (result.monthlyBuckets ?? []).map((bucket) =>
      this.mapMonthlyBucket(bucket),
    );

    const categoryTotals: CategoryTotal[] = (result.categoryTotals ?? []).map((c) => ({
      category: c.category,
      total: roundCurrency(c.total),
    }));

    return {
      currentYearTotal: roundCurrency(result.currentYearTotal ?? 0),
      previousYearTotal: roundCurrency(result.previousYearTotal ?? 0),
      allTimeTotal: roundCurrency(result.allTimeTotal ?? 0),
      expenseCount: result.expenseCount ?? 0,
      monthlyBuckets,
      categoryTotals,
    };
  }

  /** Maps one SQL month bucket (category→amount map) into the GraphQL shape.
   *  The category breakdown is generic — every category the RPC reports flows
   *  through, so new categories need no change here. */
  private mapMonthlyBucket(bucket: DashboardAggregateBucket): MonthlyBucket {
    const categories = bucket.categories ?? {};
    return {
      year: bucket.year,
      month: bucket.month,
      categories: Object.entries(categories).map(([category, total]) => ({
        category,
        total: roundCurrency(total),
      })),
      total: roundCurrency(bucket.total),
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
    bucketArg?: string | null,
  ): Promise<ExpensePhoto> {
    const bucket = photoBucketOf(bucketArg);
    this.logger.log(`addPhoto: userId=${userId}, expenseId=${expenseId}, bucket=${bucket}`);

    // P1-103 / KTD-2: Enforce storage path prefix server-side. Prevents a caller
    // from registering someone else's storage file as their own expense photo.
    // Receipts (U7b link) live at the flat `{uid}/{scanId}.webp` derived by the
    // server; legacy gallery photos live under `{uid}/expenses/{expenseId}/`.
    const expectedPrefix =
      bucket === PHOTO_BUCKETS.RECEIPTS ? `${userId}/` : `${userId}/expenses/${expenseId}/`;
    if (!storagePath.startsWith(expectedPrefix)) {
      this.logger.warn(
        `addPhoto: rejected storage path outside expected prefix. userId=${userId}, expenseId=${expenseId}, bucket=${bucket}`,
      );
      throw new BadRequestException('Invalid storage path');
    }

    // P1-102: Use the RLS-enforcing user client. The expense_photos RLS policy
    // restricts all ops to rows where user_id = auth.uid() — ownership is
    // verified by Postgres, not by a JS equality check.
    const { data: expense, error: expenseError } = await this.supabase
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
    const { count, error: countError } = await this.supabase
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

    const { data, error } = await this.supabase
      .from('expense_photos')
      .insert({
        expense_id: expenseId,
        user_id: userId,
        storage_path: storagePath,
        file_size_bytes: fileSizeBytes ?? null,
        mime_type: mimeType,
        bucket,
      })
      .select()
      .single();

    if (error || !data) {
      this.logger.error(`addPhoto failed: ${error?.message} (${error?.code})`);
      throw new BadRequestException('Failed to add photo');
    }
    const photo = await this.mapPhotoRow(data, userId);
    if (!photo) {
      // Unreachable for a legit insert (path was validated to the caller's uid),
      // but the resolver contract is nullable — surface a clear failure.
      throw new InternalServerErrorException('Failed to resolve photo URL');
    }
    return photo;
  }

  async deletePhoto(userId: string, photoId: string): Promise<boolean> {
    this.logger.log(`deletePhoto: userId=${userId}, photoId=${photoId}`);

    // P1-102: Use user client — RLS enforces ownership via the user_id column
    // on expense_photos. No need for a JS equality check.
    const { data: photo, error: photoError } = await this.supabase
      .from('expense_photos')
      .select('id, expense_id, user_id, storage_path, bucket')
      .eq('id', photoId)
      .single();

    if (photoError || !photo) throw new NotFoundException('Photo not found');

    // P1-103: Defense-in-depth check on the storage path prefix before we
    // hand it to the admin client's storage.remove. Prevents an attacker who
    // bypasses RLS (e.g. future bug) from deleting arbitrary bucket files.
    if (!photo.storage_path.startsWith(`${userId}/`)) {
      this.logger.warn(
        `deletePhoto: rejected removal of storage path outside user prefix. userId=${userId}`,
      );
      throw new NotFoundException('Photo not found');
    }

    // Delete from storage using admin client — Storage RLS is separate from
    // table RLS and the admin client is legitimate here (service-level op,
    // path has already been validated against the authenticated user). Dispatch
    // on the row's bucket so a receipts-linked photo hits the private bucket.
    const { error: storageError } = await this.adminClient.storage
      .from(photoBucketOf(photo.bucket))
      .remove([photo.storage_path]);

    if (storageError) {
      this.logger.warn(
        `deletePhoto: storage deletion failed for ${photo.storage_path}: ${storageError.message}`,
      );
    }

    const { error: deleteError } = await this.supabase
      .from('expense_photos')
      .delete()
      .eq('id', photoId);

    if (deleteError) throw new InternalServerErrorException('Failed to delete photo');
    return true;
  }

  /**
   * P1-102 + 107: Batched lookup used by the DataLoader in the resolver.
   * Relies on RLS on expense_photos to filter to the authenticated user's rows.
   */
  async findPhotosByExpenseIds(
    expenseIds: string[],
    ownerUserId: string,
  ): Promise<Map<string, ExpensePhoto[]>> {
    if (expenseIds.length === 0) return new Map();

    const { data, error } = await this.supabase
      .from('expense_photos')
      .select('*')
      .in('expense_id', expenseIds)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to fetch photos');

    const map = new Map<string, ExpensePhoto[]>();
    for (const expenseId of expenseIds) {
      map.set(expenseId, []);
    }
    // Resolve URLs concurrently — receipts rows mint a signed URL per photo.
    const resolved = await Promise.all(
      (data ?? []).map(async (row) => ({
        expenseId: row.expense_id as string,
        photo: await this.mapPhotoRow(row, ownerUserId),
      })),
    );
    for (const { expenseId, photo } of resolved) {
      if (!photo) continue; // C1: foreign-uid receipts path — never surface it.
      const photos = map.get(expenseId) ?? [];
      photos.push(photo);
      map.set(expenseId, photos);
    }
    return map;
  }

  /**
   * Single-expense photo lookup. Use `findPhotosByExpenseIds` from resolver
   * code paths that iterate over multiple expenses (DataLoader batches there).
   */
  async findPhotosByExpenseId(userId: string, expenseId: string): Promise<ExpensePhoto[]> {
    // P1-102: Use user client. RLS restricts to the current user's photos.
    // We also filter by user_id explicitly as defense-in-depth per
    // docs/solutions/integration-issues/ride-hud-reanimated-charts-mileage-patterns.md
    const { data, error } = await this.supabase
      .from('expense_photos')
      .select('*')
      .eq('expense_id', expenseId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to fetch photos');
    const resolved = await Promise.all((data ?? []).map((row) => this.mapPhotoRow(row, userId)));
    return resolved.filter((photo): photo is ExpensePhoto => photo !== null);
  }

  /**
   * Maps one photo row into the GraphQL shape, resolving its access URL by
   * bucket (U7a): legacy → public URL; receipts → short-TTL signed URL after the
   * C1 ownership assertion. Returns null when a receipts URL can't be authorized
   * (foreign-uid path / signing failure) so callers can drop it.
   */
  private async mapPhotoRow(
    row: Record<string, unknown>,
    ownerUserId: string,
  ): Promise<ExpensePhoto | null> {
    const storagePath = row.storage_path as string;
    const photoRow: PhotoStorageRow = {
      storage_path: storagePath,
      bucket: row.bucket as string | null | undefined,
      user_id: row.user_id as string | null | undefined,
    };
    const publicUrl = await resolvePhotoUrl({
      row: photoRow,
      ownerUserId,
      adminClient: this.adminClient,
      supabaseUrl: this.supabaseUrl,
      logger: this.logger,
    });
    if (publicUrl === null) return null;
    return {
      id: row.id as string,
      expenseId: row.expense_id as string,
      storagePath,
      publicUrl,
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
      itemName: row.item_name ?? undefined,
      maintenanceTaskId: row.maintenance_task_id ?? undefined,
      createdAt: row.created_at,
    };
  }
}
