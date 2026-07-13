import { NOTIFICATION_KIND } from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { addDays, format } from 'date-fns';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { resolveMaintenancePushCopy } from './maintenance-push-copy';

/** Postgres unique-violation code — a dedup-log conflict means "already sent". */
const PG_UNIQUE_VIOLATION = '23505' as const;
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

@Injectable()
export class MaintenancePushService {
  private readonly logger = new Logger(MaintenancePushService.name);
  private readonly expo = new Expo();

  // System task: reads tasks + tokens across all users, so the service-role
  // (RLS-exempt) client with explicit filters, per the Supabase client rules.
  constructor(@Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient) {}

  /**
   * Find maintenance tasks due `daysBefore` days from today and push a reminder
   * to each owner's registered devices. Idempotent: a per-(task, due_date) dedup
   * row guarantees one push per task per day even if the run repeats.
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

    // Claim + build messages only for tasks whose owner has a valid token. The dedup
    // claim is the per-(task, due_date) UNIQUE row; a conflict means already-sent.
    const messages: ExpoPushMessage[] = [];
    let skipped = 0;
    let attempted = 0;
    let noToken = 0;
    for (const task of dueTasks) {
      const tokens = (tokensByUser.get(task.user_id) ?? []).filter((t) => Expo.isExpoPushToken(t));
      if (tokens.length === 0) {
        noToken++; // owner has no registered device → nothing to send, no claim wasted
        continue;
      }

      const { error: logError } = await this.adminClient
        .from('maintenance_push_log')
        .insert({ user_id: task.user_id, task_id: task.id, due_date: task.due_date });
      if (logError) {
        if (logError.code === PG_UNIQUE_VIOLATION) skipped++;
        else this.logger.error(`dedup-log insert failed for task ${task.id}: ${logError.message}`);
        continue;
      }

      const copy = resolveMaintenancePushCopy(localeByUser.get(task.user_id));
      for (const to of tokens) {
        messages.push({
          to,
          sound: 'default',
          title: copy.title,
          body: copy.body(task.title),
          data: {
            kind: NOTIFICATION_KIND.MAINTENANCE,
            taskId: task.id,
            motorcycleId: task.motorcycle_id,
          },
        });
      }
      attempted++;
    }

    const failedTaskIds = await this.dispatch(messages);

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
   * Send messages in Expo-sized chunks. Returns the set of taskIds whose send fully
   * failed — i.e. NO device for that task was accepted — so the caller can release
   * only those dedup claims for retry. A task with ≥1 accepted device keeps its claim
   * so a same-day re-run never re-pushes to the device that already got it (dedup is
   * per-task, sends fan out per device). Prunes tokens Expo reports as DeviceNotRegistered.
   */
  private async dispatch(messages: ExpoPushMessage[]): Promise<Set<string>> {
    if (messages.length === 0) return new Set<string>();

    const taskIdOf = (m: ExpoPushMessage): string | undefined =>
      (m.data as { taskId?: string } | undefined)?.taskId;

    const failedTaskIds = new Set<string>();
    const succeededTaskIds = new Set<string>();

    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await withTimeout(
          this.expo.sendPushNotificationsAsync(chunk),
          EXPO_SEND_TIMEOUT_MS,
          'Expo push send',
        );
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const tid = taskIdOf(chunk[i]);
          if (ticket.status !== 'error') {
            if (tid) succeededTaskIds.add(tid);
            continue;
          }
          if (tid) failedTaskIds.add(tid);
          // Log every error reason (rate-limit, message-too-big, etc.), not just the
          // DeviceNotRegistered branch, so transient failures are diagnosable.
          this.logger.warn(
            `Expo push ticket error (task ${tid ?? 'unknown'}): ${ticket.details?.error ?? 'unknown'}`,
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
        // Whole chunk failed to send → mark every task in it for retry.
        this.logger.error('Expo push send failed for a chunk', err as Error);
        for (const m of chunk) {
          const tid = taskIdOf(m);
          if (tid) failedTaskIds.add(tid);
        }
      }
    }

    // Release only tasks where EVERY device failed; a task with any accepted device
    // keeps its claim so the accepted device isn't re-pushed on a same-day re-run.
    for (const tid of succeededTaskIds) failedTaskIds.delete(tid);
    return failedTaskIds;
  }
}
