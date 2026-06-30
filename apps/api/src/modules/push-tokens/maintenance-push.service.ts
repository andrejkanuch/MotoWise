import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { addDays, format } from 'date-fns';
import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { resolveMaintenancePushCopy } from './maintenance-push-copy';

/** Postgres unique-violation code — a dedup-log conflict means "already sent". */
const PG_UNIQUE_VIOLATION = '23505';
/** Mobile tap-handler discriminator (mirrors NOTIFICATION_KIND.MAINTENANCE). */
const PUSH_KIND_MAINTENANCE = 'maintenance';
const ACTIVE_TASK_STATUSES = ['pending', 'in_progress'] as const;

export interface MaintenancePushSummary {
  tasksDue: number;
  pushed: number;
  skipped: number;
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
    if (dueTasks.length === 0) return { tasksDue: 0, pushed: 0, skipped: 0 };

    // Claim each task via the dedup log; only newly-inserted (not conflicting) rows proceed.
    const fresh: DueTaskRow[] = [];
    let skipped = 0;
    for (const task of dueTasks) {
      const { error: logError } = await this.adminClient
        .from('maintenance_push_log')
        .insert({ user_id: task.user_id, task_id: task.id, due_date: task.due_date });
      if (logError) {
        if (logError.code === PG_UNIQUE_VIOLATION) {
          skipped++;
        } else {
          this.logger.error(`dedup-log insert failed for task ${task.id}: ${logError.message}`);
        }
        continue;
      }
      fresh.push(task);
    }
    if (fresh.length === 0) return { tasksDue: dueTasks.length, pushed: 0, skipped };

    // Gather each owner's device tokens.
    const userIds = [...new Set(fresh.map((t) => t.user_id))];
    const { data: tokenRows } = await this.adminClient
      .from('device_push_tokens')
      .select('user_id, token')
      .in('user_id', userIds);

    const tokensByUser = new Map<string, string[]>();
    for (const row of (tokenRows ?? []) as Array<{ user_id: string; token: string }>) {
      const list = tokensByUser.get(row.user_id) ?? [];
      list.push(row.token);
      tokensByUser.set(row.user_id, list);
    }

    // Resolve each owner's locale so the push copy is localized. preferences is a
    // service-role-only read (00141); preferences.locale holds the app language.
    const { data: userRows } = await this.adminClient
      .from('users')
      .select('id, preferences')
      .in('id', userIds);

    const localeByUser = new Map<string, string | null>();
    for (const row of (userRows ?? []) as Array<{ id: string; preferences: unknown }>) {
      const prefs = (row.preferences ?? {}) as { locale?: string | null };
      localeByUser.set(row.id, prefs.locale ?? null);
    }

    const messages: ExpoPushMessage[] = [];
    let pushed = 0;
    for (const task of fresh) {
      const tokens = (tokensByUser.get(task.user_id) ?? []).filter((t) => Expo.isExpoPushToken(t));
      if (tokens.length === 0) continue;
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
      pushed++;
    }

    await this.dispatch(messages);
    this.logger.log(
      `sendDuePush(${daysBefore}d): due=${dueTasks.length} pushed=${pushed} skipped=${skipped}`,
    );
    return { tasksDue: dueTasks.length, pushed, skipped };
  }

  /** Send messages in Expo-sized chunks; prune tokens the receipts report as dead. */
  private async dispatch(messages: ExpoPushMessage[]): Promise<void> {
    if (messages.length === 0) return;
    for (const chunk of this.expo.chunkPushNotifications(messages)) {
      try {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            const deadToken = chunk[i].to;
            const token = Array.isArray(deadToken) ? deadToken[0] : deadToken;
            await this.adminClient.from('device_push_tokens').delete().eq('token', token);
          }
        }
      } catch (err) {
        this.logger.error('Expo push send failed for a chunk', err as Error);
      }
    }
  }
}
