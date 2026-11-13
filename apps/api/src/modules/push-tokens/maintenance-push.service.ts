import { NOTIFICATION_KIND } from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { addDays, format, subDays } from 'date-fns';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { PG_ERROR } from '../../common/supabase/unwrap';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { resolveMaintenancePushCopy } from './maintenance-push-copy';

/** Expo ticket error reported for a token the device store no longer recognizes. */
const EXPO_DEVICE_NOT_REGISTERED = 'DeviceNotRegistered' as const;
/** Cap each Expo push HTTP call so a hung exp.host never blocks the run/request. */
const EXPO_SEND_TIMEOUT_MS = 15_000;
/** Safety valve: bound a single run's work. If ever hit, the overflow is logged (not
 *  silently dropped) so the cap can be raised or the send paginated. */
const MAX_DUE_TASKS_PER_RUN = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    timer.unref?.();
  });
  // Clear the timer on settle so the happy path doesn't leave a dangling 15s timeout.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
const ACTIVE_TASK_STATUSES = ['pending', 'in_progress'] as const;
/**
 * activation T07a (D7): at most one maintenance push per bike in this many days. An
 * imported service plan puts ~10 tasks on the same interval anniversaries.
 */
export const PER_BIKE_PUSH_WINDOW_DAYS = 7;
/** Page size for the 7-day push-history read; below PostgREST's default `max_rows` (1000). */
const RECENT_PUSH_PAGE_SIZE = 500;

export interface MaintenancePushSummary {
  tasksDue: number;
  pushed: number;
  skipped: number;
  /** Tasks whose Expo send errored; their dedup claim is released for a same-day retry. */
  failed: number;
  /** Due tasks whose owner has no registered device token — nothing to send. */
  noToken: number;
}

interface DueTaskRow {
  id: string;
  user_id: string;
  title: string;
  due_date: string;
  motorcycle_id: string;
}

interface BikeNameRow {
  id: string;
  nickname: string | null;
  make: string | null;
  model: string | null;
}

/** A `maintenance_push_log` row with its task's bike (many-to-one embed on task_id). */
interface RecentPushRow {
  maintenance_tasks: { motorcycle_id: string } | Array<{ motorcycle_id: string }> | null;
}

/** What the rider calls the bike: nickname, else model (empty on make-only bikes), else make. */
function bikeDisplayName(row: BikeNameRow | undefined): string | null {
  return row?.nickname?.trim() || row?.model?.trim() || row?.make?.trim() || null;
}

@Injectable()
export class MaintenancePushService {
  private readonly logger = new Logger(MaintenancePushService.name);
  private readonly expo = new Expo();

  // System task: reads tasks + tokens across all users, so the service-role
  // (RLS-exempt) client with explicit filters, per the Supabase client rules.
  constructor(@Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient) {}

  /**
   * Find maintenance tasks due `daysBefore` days from today and push a reminder
   * to each owner's registered devices. At most one push per bike, naming the count
   * when several tasks are due, and none for a bike pushed in the last 7 days (activation
   * T07a, D7). Idempotent: a per-(task, due_date) dedup row is still written for
   * every task the push covers, so a re-run never re-sends.
   */
  async sendDuePush(daysBefore: number): Promise<MaintenancePushSummary> {
    const dueDate = format(addDays(new Date(), daysBefore), 'yyyy-MM-dd');

    const { data: tasks, error } = await this.adminClient
      .from('maintenance_tasks')
      .select('id, user_id, title, due_date, motorcycle_id')
      .in('status', ACTIVE_TASK_STATUSES as unknown as string[])
      .is('deleted_at', null)
      .eq('due_date', dueDate)
      .limit(MAX_DUE_TASKS_PER_RUN);

    if (error) {
      this.logger.error(`sendDuePush task query failed: ${error.message} (${error.code})`);
      throw error;
    }
    const dueTasks = (tasks ?? []) as DueTaskRow[];
    if (dueTasks.length === MAX_DUE_TASKS_PER_RUN) {
      // Hit the per-run cap — some due tasks may be unprocessed this run. Surface it.
      this.logger.warn(
        `sendDuePush hit the ${MAX_DUE_TASKS_PER_RUN}-task cap; overflow deferred — raise the cap or paginate.`,
      );
    }
    if (dueTasks.length === 0) return { tasksDue: 0, pushed: 0, skipped: 0, failed: 0, noToken: 0 };

    // Fetch tokens + locales for ALL due-task owners FIRST (before claiming), so a DB
    // error throws here and wastes no dedup claim, and we only claim sendable tasks.
    const userIds = [...new Set(dueTasks.map((t) => t.user_id))];

    const { data: tokenRows, error: tokenError } = await this.adminClient
      .from('device_push_tokens')
      .select('user_id, token')
      .in('user_id', userIds);
    if (tokenError) {
      this.logger.error(`sendDuePush token query failed: ${tokenError.message}`);
      throw tokenError;
    }
    const tokensByUser = new Map<string, string[]>();
    for (const row of (tokenRows ?? []) as Array<{ user_id: string; token: string }>) {
      const list = tokensByUser.get(row.user_id) ?? [];
      list.push(row.token);
      tokensByUser.set(row.user_id, list);
    }

    // Resolve each owner's locale so the push copy is localized. preferences is a
    // service-role-only read (00141); preferences.locale holds the app language.
    const { data: userRows, error: userError } = await this.adminClient
      .from('users')
      .select('id, preferences')
      .in('id', userIds);
    if (userError) {
      this.logger.error(`sendDuePush user query failed: ${userError.message}`);
      throw userError;
    }
    const localeByUser = new Map<string, string | null>();
    for (const row of (userRows ?? []) as Array<{ id: string; preferences: unknown }>) {
      const prefs = (row.preferences ?? {}) as { locale?: string | null };
      localeByUser.set(row.id, prefs.locale ?? null);
    }

    // D7 reminder cap (activation T07a): group the due tasks by bike, send at most ONE push
    // per bike, and none for a bike that got a maintenance push in the last 7 days.
    // Both lookups run before any claim, so a DB error throws and wastes no claim.
    const tasksByBike = new Map<string, DueTaskRow[]>();
    for (const task of dueTasks) {
      const group = tasksByBike.get(task.motorcycle_id) ?? [];
      group.push(task);
      tasksByBike.set(task.motorcycle_id, group);
    }
    const recentlyPushedBikes = await this.bikesPushedSince(
      userIds,
      [...tasksByBike.keys()],
      subDays(new Date(), PER_BIKE_PUSH_WINDOW_DAYS),
    );
    const bikeNames = await this.loadBikeNames([...tasksByBike.keys()]);

    // Claim + build messages only for bikes whose owner has a valid token. The dedup
    // claim stays one per-(task, due_date) UNIQUE row, so re-runs are idempotent per
    // task; a conflict means already-sent.
    const messages: ExpoPushMessage[] = [];
    const claimedTaskIdsByBike = new Map<string, string[]>();
    let skipped = 0;
    let attempted = 0;
    let noToken = 0;
    for (const [motorcycleId, bikeTasks] of tasksByBike) {
      const ownerId = bikeTasks[0].user_id;
      const tokens = (tokensByUser.get(ownerId) ?? []).filter((t) => Expo.isExpoPushToken(t));
      if (tokens.length === 0) {
        noToken += bikeTasks.length; // owner has no registered device → nothing to send, no claim wasted
        continue;
      }
      if (recentlyPushedBikes.has(motorcycleId)) {
        skipped += bikeTasks.length; // capped: this bike had a push in the last 7 days
        continue;
      }

      const claimed: DueTaskRow[] = [];
      for (const task of bikeTasks) {
        const { error: logError } = await this.adminClient
          .from('maintenance_push_log')
          .insert({ user_id: task.user_id, task_id: task.id, due_date: task.due_date });
        if (logError) {
          if (logError.code === PG_ERROR.UNIQUE_VIOLATION) skipped++;
          else
            this.logger.error(`dedup-log insert failed for task ${task.id}: ${logError.message}`);
          continue;
        }
        claimed.push(task);
      }
      if (claimed.length === 0) continue;

      const copy = resolveMaintenancePushCopy(localeByUser.get(ownerId));
      const bikeName = bikeNames.get(motorcycleId);
      const body =
        claimed.length > 1 && bikeName
          ? copy.combinedBody(claimed.length, bikeName)
          : copy.body(claimed[0].title);
      for (const to of tokens) {
        messages.push({
          to,
          sound: 'default',
          title: copy.title,
          body,
          data: {
            kind: NOTIFICATION_KIND.MAINTENANCE,
            taskId: claimed[0].id,
            motorcycleId,
            taskCount: claimed.length,
          },
        });
      }
      claimedTaskIdsByBike.set(
        motorcycleId,
        claimed.map((t) => t.id),
      );
      attempted += claimed.length;
    }

    const failedBikeIds = await this.dispatch(messages);
    const failedTaskIds = new Set(
      [...failedBikeIds].flatMap((bikeId) => claimedTaskIdsByBike.get(bikeId) ?? []),
    );

    // Release the dedup claim for tasks whose send errored, so a same-day re-run
    // retries them instead of the claim permanently masking a lost push.
    if (failedTaskIds.size > 0) {
      const { error: releaseError } = await this.adminClient
        .from('maintenance_push_log')
        .delete()
        .eq('due_date', dueDate)
        .in('task_id', [...failedTaskIds]);
      // supabase-js returns errors rather than throwing; an unchecked failure here
      // would leave the dedup rows in place, permanently masking these tasks as sent.
      if (releaseError) {
        this.logger.error(
          `sendDuePush failed to release ${failedTaskIds.size} dedup claim(s) for retry: ${releaseError.message}`,
        );
      }
    }

    const failed = failedTaskIds.size;
    const pushed = attempted - failed;
    // due = pushed + skipped + failed + noToken, so the counts reconcile with tasksDue.
    const summary = `sendDuePush(${daysBefore}d): due=${dueTasks.length} pushed=${pushed} skipped=${skipped} failed=${failed} noToken=${noToken}`;
    // Escalate to warn when any send failed so partial failures aren't lost in info logs.
    if (failed > 0) this.logger.warn(summary);
    else this.logger.log(summary);
    return { tasksDue: dueTasks.length, pushed, skipped, failed, noToken };
  }

  /**
   * Bikes that got a maintenance push since `since`: the push log has no bike
   * column (00161), so its rows are joined on task_id → maintenance_tasks.motorcycle_id
   * and filtered to the bikes due in this run. Paged, so PostgREST's `max_rows` cap
   * can never hide a recent push and let a bike through the cap.
   * Throws on a DB error so the run claims nothing rather than over-sending.
   */
  private async bikesPushedSince(
    userIds: string[],
    motorcycleIds: string[],
    since: Date,
  ): Promise<Set<string>> {
    const bikes = new Set<string>();
    for (let from = 0; ; from += RECENT_PUSH_PAGE_SIZE) {
      const { data, error } = await this.adminClient
        .from('maintenance_push_log')
        .select('id, maintenance_tasks!inner(motorcycle_id)')
        .in('user_id', userIds)
        .in('maintenance_tasks.motorcycle_id', motorcycleIds)
        .gte('sent_at', since.toISOString())
        .order('id', { ascending: true })
        .range(from, from + RECENT_PUSH_PAGE_SIZE - 1);
      if (error) {
        this.logger.error(`sendDuePush recent-push query failed: ${error.message}`);
        throw error;
      }
      const rows = (data ?? []) as unknown as RecentPushRow[];
      for (const row of rows) {
        const tasks = row.maintenance_tasks;
        for (const task of Array.isArray(tasks) ? tasks : tasks ? [tasks] : []) {
          bikes.add(task.motorcycle_id);
        }
      }
      if (rows.length < RECENT_PUSH_PAGE_SIZE) return bikes;
    }
  }

  /** Display names for the combined push ("3 services due on your MT-09"). */
  private async loadBikeNames(motorcycleIds: string[]): Promise<Map<string, string>> {
    const { data, error } = await this.adminClient
      .from('motorcycles')
      .select('id, nickname, make, model')
      .in('id', motorcycleIds);
    if (error) {
      this.logger.error(`sendDuePush motorcycle query failed: ${error.message}`);
      throw error;
    }
    const names = new Map<string, string>();
    for (const row of (data ?? []) as BikeNameRow[]) {
      const name = bikeDisplayName(row);
      if (name) names.set(row.id, name);
    }
    return names;
  }

  /**
   * Send messages in Expo-sized chunks. Returns the set of bike ids whose push fully
   * failed — i.e. NO device for that bike's push was accepted — so the caller can
   * release only those bikes' dedup claims for retry. A bike with ≥1 accepted device
   * keeps its claims so a same-day re-run never re-pushes to the device that already
   * got it (one push per bike, fanned out per device). Prunes tokens Expo reports as
   * DeviceNotRegistered.
   */
  private async dispatch(messages: ExpoPushMessage[]): Promise<Set<string>> {
    if (messages.length === 0) return new Set<string>();

    const bikeIdOf = (m: ExpoPushMessage): string | undefined =>
      (m.data as { motorcycleId?: string } | undefined)?.motorcycleId;

    const failedBikeIds = new Set<string>();
    const succeededBikeIds = new Set<string>();

    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await withTimeout(
          this.expo.sendPushNotificationsAsync(chunk),
          EXPO_SEND_TIMEOUT_MS,
          'Expo push send',
        );
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const bid = bikeIdOf(chunk[i]);
          if (ticket.status !== 'error') {
            if (bid) succeededBikeIds.add(bid);
            continue;
          }
          if (bid) failedBikeIds.add(bid);
          // Log every error reason (rate-limit, message-too-big, etc.), not just the
          // DeviceNotRegistered branch, so transient failures are diagnosable.
          this.logger.warn(
            `Expo push ticket error (bike ${bid ?? 'unknown'}): ${ticket.details?.error ?? 'unknown'}`,
          );
          if (ticket.details?.error === EXPO_DEVICE_NOT_REGISTERED) {
            const deadToken = chunk[i].to;
            const token = Array.isArray(deadToken) ? deadToken[0] : deadToken;
            // Isolate the prune: a failed cleanup delete must NOT bubble into the
            // chunk-wide catch, which would falsely mark already-succeeded tickets in
            // this chunk as failed and re-send to them on the next run.
            try {
              const { error: pruneError } = await this.adminClient
                .from('device_push_tokens')
                .delete()
                .eq('token', token);
              if (pruneError) {
                this.logger.warn(`Failed to prune dead token: ${pruneError.message}`);
              }
            } catch (pruneErr) {
              this.logger.warn(`Failed to prune dead token: ${(pruneErr as Error).message}`);
            }
          }
        }
      } catch (err) {
        // Whole chunk failed to send → mark every bike in it for retry.
        this.logger.error('Expo push send failed for a chunk', err as Error);
        for (const m of chunk) {
          const bid = bikeIdOf(m);
          if (bid) failedBikeIds.add(bid);
        }
      }
    }

    // Release only bikes where EVERY device failed; a bike with any accepted device
    // keeps its claims so the accepted device isn't re-pushed on a same-day re-run.
    for (const bid of succeededBikeIds) failedBikeIds.delete(bid);
    return failedBikeIds;
  }
}
