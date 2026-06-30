import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { addDays, format } from 'date-fns';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { resolveMaintenancePushCopy } from './maintenance-push-copy';

/** Postgres unique-violation code — a dedup-log conflict means "already sent". */
const PG_UNIQUE_VIOLATION = '23505' as const;
/** Mobile tap-handler discriminator (mirrors NOTIFICATION_KIND.MAINTENANCE). */
const PUSH_KIND_MAINTENANCE = 'maintenance' as const;
/** Expo ticket error reported for a token the device store no longer recognizes. */
const EXPO_DEVICE_NOT_REGISTERED = 'DeviceNotRegistered' as const;
const ACTIVE_TASK_STATUSES = ['pending', 'in_progress'] as const;

export interface MaintenancePushSummary {
  tasksDue: number;
  pushed: number;
  skipped: number;
  /** Tasks whose Expo send errored; their dedup claim is released for a same-day retry. */
  failed: number;
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
      .eq('due_date', dueDate);

    if (error) {
      this.logger.error(`sendDuePush task query failed: ${error.message} (${error.code})`);
      throw error;
    }
    const dueTasks = (tasks ?? []) as DueTaskRow[];
    if (dueTasks.length === 0) return { tasksDue: 0, pushed: 0, skipped: 0, failed: 0 };

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
    for (const task of dueTasks) {
      const tokens = (tokensByUser.get(task.user_id) ?? []).filter((t) => Expo.isExpoPushToken(t));
      if (tokens.length === 0) continue; // nothing to send → don't waste a claim

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
          data: { kind: PUSH_KIND_MAINTENANCE, taskId: task.id, motorcycleId: task.motorcycle_id },
        });
      }
      attempted++;
    }

    const failedTaskIds = await this.dispatch(messages);

    // Release the dedup claim for tasks whose send errored, so a same-day re-run
    // retries them instead of the claim permanently masking a lost push.
    if (failedTaskIds.size > 0) {
      await this.adminClient
        .from('maintenance_push_log')
        .delete()
        .eq('due_date', dueDate)
        .in('task_id', [...failedTaskIds]);
    }

    const failed = failedTaskIds.size;
    const pushed = attempted - failed;
    this.logger.log(
      `sendDuePush(${daysBefore}d): due=${dueTasks.length} pushed=${pushed} skipped=${skipped} failed=${failed}`,
    );
    return { tasksDue: dueTasks.length, pushed, skipped, failed };
  }

  /**
   * Send messages in Expo-sized chunks. Returns the set of taskIds whose send errored
   * (whole-chunk throw or per-message error ticket) so the caller can release their
   * dedup claim for retry. Prunes tokens Expo reports as DeviceNotRegistered.
   */
  private async dispatch(messages: ExpoPushMessage[]): Promise<Set<string>> {
    const failedTaskIds = new Set<string>();
    if (messages.length === 0) return failedTaskIds;

    const taskIdOf = (m: ExpoPushMessage): string | undefined =>
      (m.data as { taskId?: string } | undefined)?.taskId;

    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status !== 'error') continue;
          const tid = taskIdOf(chunk[i]);
          if (tid) failedTaskIds.add(tid);
          if (ticket.details?.error === EXPO_DEVICE_NOT_REGISTERED) {
            const deadToken = chunk[i].to;
            const token = Array.isArray(deadToken) ? deadToken[0] : deadToken;
            await this.adminClient.from('device_push_tokens').delete().eq('token', token);
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
    return failedTaskIds;
  }
}
