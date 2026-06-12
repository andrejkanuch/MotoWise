import { AI_FEATURE_LIMITS, AiRideSummaryResponseSchema } from '@motovault/types';
import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { RIDE_EVENTS, type RideCompletedEvent } from '../../common/constants/events';
import { AI_CLIENT, AI_MODELS, costCentsFor } from '../../config/constants';
import { AiBudgetService } from '../ai-budget/ai-budget.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { RideSummary } from './models/ride-summary.model';

const MODEL = AI_MODELS.RIDE_SUMMARY;
const MAX_SUMMARY_TOKENS = 512;

/** Local row interface matching ride_summaries DB columns */
interface RideSummaryRow {
  id: string;
  ride_id: string;
  summary_text: string;
  generation_status: string;
  locale: string;
  created_at: string;
  updated_at: string;
}

/** Shape returned by the rides select in generateSummary */
interface RideDataRow {
  id: string;
  user_id: string;
  motorcycle_id: string | null;
  name: string | null;
  distance_m: number | null;
  started_at: string;
  ended_at: string | null;
  max_speed_mps: number | null;
  avg_speed_mps: number | null;
  elevation_gain: number | null;
  elevation_loss: number | null;
  region: string | null;
  paused_duration_s: number | null;
}

/** Shape returned by the motorcycles select for bike info */
interface RideBikeRow {
  make: string;
  model: string;
  year: number;
}

/** Shape returned by ride_summaries id-only select */
interface SummaryIdRow {
  id: string;
}

/** Minimum thresholds to generate a summary */
const MIN_DISTANCE_M = 1000;
const MIN_DURATION_S = 300;

/**
 * SINGLETON, admin-client only — deliberately. The previous version injected
 * SUPABASE_USER, which made the service request-scoped; @nestjs/event-emitter
 * builds request-scoped listeners' DI context from the EVENT PAYLOAD, so the
 * ride.completed listener got an anon client and silently failed RLS for every
 * private ride (the default visibility). Every query below carries an explicit
 * user_id/ride_id filter as the ownership check; userId always originates from
 * a verified JWT or the trusted event payload.
 */
@Injectable()
export class RideSummariesService {
  private readonly logger = new Logger(RideSummariesService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
    private readonly aiBudgetService: AiBudgetService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
      maxRetries: AI_CLIENT.MAX_RETRIES,
      timeout: AI_CLIENT.TIMEOUT_MS,
    });
  }

  async generateSummary(rideId: string, userId: string, locale: string): Promise<RideSummary> {
    await this.enforceFreeTierSummaryLimit(userId);

    // Check AI budget before processing
    await this.aiBudgetService.checkBudgetForUser(userId);

    // Admin client + explicit user_id filter (see class doc-comment)
    const { data: ride, error: rideError } = await this.adminClient
      .from('rides')
      .select(
        'id, user_id, motorcycle_id, name, distance_m, started_at, ended_at, max_speed_mps, avg_speed_mps, elevation_gain, elevation_loss, region, paused_duration_s',
      )
      .eq('id', rideId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .single();

    if (rideError || !ride) {
      throw new NotFoundException('Ride not found or not completed');
    }

    const typedRide = ride as unknown as RideDataRow;

    const distanceM = typedRide.distance_m ?? 0;
    const durationS = typedRide.ended_at
      ? Math.round(
          (new Date(typedRide.ended_at).getTime() - new Date(typedRide.started_at).getTime()) /
            1000,
        ) - (typedRide.paused_duration_s ?? 0)
      : 0;

    if (distanceM < MIN_DISTANCE_M || durationS < MIN_DURATION_S) {
      throw new NotFoundException(
        'Ride is too short for summary generation (minimum 1 km and 5 minutes)',
      );
    }

    // Fetch motorcycle info if linked (scoped to the ride owner)
    let bikeInfo = 'motorcycle';
    if (typedRide.motorcycle_id) {
      const { data: bike } = await this.adminClient
        .from('motorcycles')
        .select('make, model, year')
        .eq('id', typedRide.motorcycle_id)
        .eq('user_id', userId)
        .single();

      if (bike) {
        const typedBike = bike as unknown as RideBikeRow;
        const parts = [typedBike.year, typedBike.make, typedBike.model].filter(Boolean);
        bikeInfo = parts.length > 0 ? parts.join(' ') : 'motorcycle';
      }
    }

    // Sanitize user inputs before including in prompt
    const rideName = sanitize(typedRide.name);
    const region = sanitize(typedRide.region);

    // Build structured context (NO raw GPS)
    const context: Record<string, unknown> = {
      distanceKm: Math.round(distanceM / 100) / 10,
      durationMinutes: Math.round(durationS / 60),
      bike: bikeInfo,
    };

    if (typedRide.max_speed_mps) {
      context.maxSpeedKmh = Math.round(typedRide.max_speed_mps * 3.6);
    }
    if (typedRide.avg_speed_mps) {
      context.avgSpeedKmh = Math.round(typedRide.avg_speed_mps * 3.6);
    }
    if (typedRide.elevation_gain) {
      context.elevationGainM = Math.round(typedRide.elevation_gain);
    }
    if (typedRide.elevation_loss) {
      context.elevationLossM = Math.round(typedRide.elevation_loss);
    }
    if (region) {
      context.region = region;
    }
    if (rideName) {
      context.rideName = rideName;
    }

    const systemPrompt = [
      'You are a motorcycle ride summary writer. Generate a short, engaging summary of the ride.',
      'Write in the voice of a fellow rider — enthusiastic but not over-the-top.',
      'Use city-level location only, never mention specific neighborhoods or streets.',
      'Keep it concise: 2-4 sentences.',
      `Write the summary in the following language/locale: ${locale}.`,
    ].join('\n');

    const userPrompt = `Summarize this motorcycle ride:\n${JSON.stringify(context, null, 2)}`;

    // Create or find existing summary record
    const { data: existingSummary } = await this.adminClient
      .from('ride_summaries')
      .select('id')
      .eq('ride_id', rideId)
      .maybeSingle();

    const typedExisting = existingSummary as unknown as SummaryIdRow | null;
    const summaryId = typedExisting?.id;

    try {
      const completion = await this.openai.chat.completions.parse({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: zodResponseFormat(AiRideSummaryResponseSchema, 'ride_summary'),
        max_tokens: MAX_SUMMARY_TOKENS,
      });

      const inputTokens = completion.usage?.prompt_tokens ?? 0;
      const outputTokens = completion.usage?.completion_tokens ?? 0;

      const parsed = completion.choices[0].message.parsed;
      if (!parsed) {
        await this.updateStatus(rideId, summaryId, 'failed');
        throw new Error('AI did not return structured ride summary');
      }

      const summaryText = parsed.summaryText;

      // Write to BOTH ride_summaries AND rides.ai_summary
      const now = new Date().toISOString();

      if (summaryId) {
        // Update existing
        await Promise.all([
          this.adminClient
            .from('ride_summaries')
            .update({
              summary_text: summaryText,
              generation_status: 'completed',
              locale,
              updated_at: now,
            })
            .eq('id', summaryId),
          this.adminClient.from('rides').update({ ai_summary: summaryText }).eq('id', rideId),
        ]);
      } else {
        // Insert new
        const [insertResult] = await Promise.all([
          this.adminClient
            .from('ride_summaries')
            .insert({
              ride_id: rideId,
              summary_text: summaryText,
              generation_status: 'completed',
              locale,
            })
            .select()
            .single(),
          this.adminClient.from('rides').update({ ai_summary: summaryText }).eq('id', rideId),
        ]);

        if (insertResult.error) {
          this.logger.error('Failed to insert ride summary', insertResult.error);
        }
      }

      const costCents = costCentsFor(MODEL, inputTokens, outputTokens);

      const { error: logError } = await this.adminClient.from('content_generation_log').insert({
        user_id: userId,
        content_type: 'ride_summary',
        content_id: rideId,
        model: MODEL,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_cents: costCents,
        status: 'success',
      });
      if (logError) this.logger.error('Failed to log ride summary generation', logError);

      // Return the summary
      const { data: result, error: fetchError } = await this.adminClient
        .from('ride_summaries')
        .select('*')
        .eq('ride_id', rideId)
        .single();

      if (fetchError || !result) {
        this.logger.error(`Failed to fetch saved ride summary for ride ${rideId}`, fetchError);
        throw new NotFoundException('Ride summary not found after generation');
      }

      return this.mapRow(result as unknown as RideSummaryRow);
    } catch (err) {
      await this.updateStatus(rideId, summaryId, 'failed');

      // Log failure (fire-and-forget)
      this.adminClient
        .from('content_generation_log')
        .insert({
          user_id: userId,
          content_type: 'ride_summary',
          content_id: rideId,
          model: MODEL,
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
        })
        .then(({ error: logErr }) => {
          if (logErr) this.logger.error('Failed to log ride summary failure', logErr);
        });

      throw err;
    }
  }

  private async enforceFreeTierSummaryLimit(userId: string): Promise<void> {
    const { data: userData, error: userError } = await this.adminClient
      .from('users')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    if (userError) {
      this.logger.error('Failed to fetch subscription tier for ride summary quota', userError);
      throw new InternalServerErrorException('Unable to verify subscription status.');
    }

    const tier = (userData?.subscription_tier as 'free' | 'pro') ?? 'free';
    if (tier === 'pro') return;

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { count, error } = await this.adminClient
      .from('content_generation_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('content_type', 'ride_summary')
      .eq('status', 'success')
      .gte('created_at', monthStart.toISOString());

    if (error) {
      // Fail CLOSED: this gates paid AI spend; the tier lookup above already does.
      this.logger.error('Failed to count monthly ride summary usage', error);
      throw new InternalServerErrorException('Unable to verify ride summary quota.');
    }

    const limit = AI_FEATURE_LIMITS.FREE_RIDE_SUMMARIES_PER_MONTH;
    if ((count ?? 0) >= limit) {
      throw new ForbiddenException(
        `Free plan allows ${limit} AI ride summaries per month. Upgrade to Pro for more AI ride recaps.`,
      );
    }
  }

  // suppressErrors:false — event-emitter v3 swallows listener errors by default;
  // the try/catch below is the deliberate error boundary instead.
  @OnEvent(RIDE_EVENTS.COMPLETED, { async: true, suppressErrors: false })
  async onRideCompleted(payload: RideCompletedEvent): Promise<void> {
    this.logger.log(`ride.completed event received for ride ${payload.rideId}`);
    try {
      // Idempotency: a duplicate event must not pay for a second generation
      const { data: existing } = await this.adminClient
        .from('ride_summaries')
        .select('id, generation_status')
        .eq('ride_id', payload.rideId)
        .maybeSingle();
      if ((existing as { generation_status?: string } | null)?.generation_status === 'completed') {
        this.logger.log(`Summary already exists for ride ${payload.rideId}, skipping`);
        return;
      }

      await this.generateSummary(payload.rideId, payload.userId, payload.locale);
      this.logger.log(`Ride summary generated for ride ${payload.rideId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to auto-generate ride summary for ${payload.rideId}: ${msg}`);
      // Non-fatal — ride is already saved
    }
  }

  private async updateStatus(
    rideId: string,
    summaryId: string | undefined,
    status: string,
  ): Promise<void> {
    if (summaryId) {
      await this.adminClient
        .from('ride_summaries')
        .update({ generation_status: status })
        .eq('id', summaryId);
    } else {
      await this.adminClient.from('ride_summaries').insert({
        ride_id: rideId,
        summary_text: '',
        generation_status: status,
        locale: 'en',
      });
    }
  }

  private mapRow(row: RideSummaryRow): RideSummary {
    return {
      id: row.id,
      rideId: row.ride_id,
      summaryText: row.summary_text,
      generationStatus: row.generation_status,
      locale: row.locale,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char stripping for input sanitization
const CONTROL_CHARS_RE = /[\x00-\x1F\x7F]/g;

/** Strip control characters and trim to max 200 chars */
function sanitize(input: string | null | undefined): string | null {
  if (!input) return null;
  return input.replace(CONTROL_CHARS_RE, '').trim().slice(0, 200) || null;
}
