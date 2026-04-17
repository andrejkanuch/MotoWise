import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { AI_CLIENT, AI_MODELS } from '../../config/constants';
import { AiBudgetService } from '../ai-budget/ai-budget.service';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { AskTripAssistantInput } from './dto/ask-trip-assistant.input';
import type { TripAssistantMessage } from './models/trip-assistant-message.model';

const MODEL = AI_MODELS.INSIGHTS; // gpt-4.1-mini — cheap + good enough for trip chat
const MAX_HISTORY_TURNS = 8;
const MAX_QUESTION_LEN = 1200;
const MAX_OUTPUT_TOKENS = 700;

interface TripRow {
  id: string;
  organiser_user_id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  visibility: string;
  difficulty: string | null;
  max_riders: number | null;
}

interface WaypointRow {
  sort_order: number;
  day_index: number | null;
  period_of_day: string | null;
  type: string;
  name: string;
  notes: string | null;
  lat: number;
  lng: number;
}

interface BikeRow {
  make: string | null;
  model: string | null;
  year: number | null;
  type: string | null;
  engine_cc: number | null;
  current_mileage: number | null;
  mileage_unit: string | null;
  nickname: string | null;
}

@Injectable()
export class TripAssistantService {
  private readonly logger = new Logger(TripAssistantService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    private readonly aiBudget: AiBudgetService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.getOrThrow('OPENAI_API_KEY'),
      maxRetries: AI_CLIENT.MAX_RETRIES,
      timeout: AI_CLIENT.TIMEOUT_MS,
    });
  }

  async ask(userId: string, input: AskTripAssistantInput): Promise<TripAssistantMessage> {
    await this.aiBudget.checkBudgetForUser(userId);

    const question = input.question.trim().slice(0, MAX_QUESTION_LEN);
    if (!question) throw new NotFoundException('Empty question');

    const trip = await this.loadTripContext(input.tripId);
    const bike = await this.loadPrimaryBike(userId);

    const system = this.buildSystemPrompt(trip, bike);
    const history = (input.history ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_HISTORY_TURNS * 2)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: String(m.content).slice(0, 2000),
      }));

    try {
      const response = await this.openai.chat.completions.create({
        model: MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0.5,
        messages: [
          { role: 'system', content: system },
          ...history,
          { role: 'user', content: question },
        ],
      });

      const message = response.choices[0]?.message?.content?.trim() ?? '';
      if (!message) {
        throw new InternalServerErrorException('AI returned an empty response');
      }

      return {
        message,
        inputTokens: response.usage?.prompt_tokens,
        outputTokens: response.usage?.completion_tokens,
      };
    } catch (err) {
      this.logger.error('trip-assistant OpenAI call failed', err);
      throw new InternalServerErrorException('AI assistant is unavailable — try again in a bit.');
    }
  }

  private async loadTripContext(tripId: string): Promise<{
    trip: TripRow;
    waypoints: WaypointRow[];
  }> {
    // RLS on `trips` already enforces visibility. If the caller can't see the
    // trip we surface NotFound rather than 403 to avoid ID oracles.
    const { data: tripData, error: tripErr } = await this.supabase
      .from('trips')
      .select(
        'id, organiser_user_id, title, description, start_date, end_date, status, visibility, difficulty, max_riders',
      )
      .eq('id', tripId)
      .maybeSingle();

    if (tripErr || !tripData) throw new NotFoundException('Trip not found');

    const { data: wpData } = await this.supabase
      .from('trip_waypoints')
      .select('sort_order, day_index, period_of_day, type, name, notes, lat, lng')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true });

    return {
      trip: tripData as unknown as TripRow,
      waypoints: (wpData ?? []) as unknown as WaypointRow[],
    };
  }

  private async loadPrimaryBike(userId: string): Promise<BikeRow | null> {
    const { data } = await this.supabase
      .from('motorcycles')
      .select('make, model, year, type, engine_cc, current_mileage, mileage_unit, nickname')
      .eq('user_id', userId)
      .eq('is_primary', true)
      .maybeSingle();
    return (data ?? null) as BikeRow | null;
  }

  private buildSystemPrompt(
    ctx: { trip: TripRow; waypoints: WaypointRow[] },
    bike: BikeRow | null,
  ): string {
    const { trip, waypoints } = ctx;
    const bikeLine = bike
      ? `${bike.year ?? ''} ${bike.make ?? ''} ${bike.model ?? ''}${bike.engine_cc ? ` ${bike.engine_cc}cc` : ''}${bike.type ? ` (${bike.type})` : ''}${
          bike.current_mileage ? `, odometer ${bike.current_mileage} ${bike.mileage_unit ?? 'km'}` : ''
        }`.trim()
      : 'No primary bike on file';

    const wpByDay = new Map<number, WaypointRow[]>();
    for (const wp of waypoints) {
      const day = wp.day_index ?? 0;
      const bucket = wpByDay.get(day) ?? [];
      bucket.push(wp);
      wpByDay.set(day, bucket);
    }
    const dayLines: string[] = [];
    for (const [day, items] of [...wpByDay.entries()].sort((a, b) => a[0] - b[0])) {
      dayLines.push(`Day ${day + 1}:`);
      for (const wp of items) {
        const period = wp.period_of_day ? ` [${wp.period_of_day}]` : '';
        const notes = wp.notes ? ` — ${wp.notes.replace(/\s+/g, ' ').slice(0, 160)}` : '';
        dayLines.push(`  - ${wp.type}${period}: ${wp.name} (${wp.lat.toFixed(3)},${wp.lng.toFixed(3)})${notes}`);
      }
    }

    return [
      'You are MotoWise, a motorcycle trip co-pilot. You are talking to a rider about their own trip.',
      'Be concise, practical, and specific. Prefer short paragraphs or compact bullet lists.',
      "When asked about routing, fuel, weather, or detours, call out the relevant waypoint names explicitly.",
      'If the user asks something unrelated to motorcycling or this trip, politely redirect.',
      'Never invent data. If something is missing (gear, hotels, tire wear), say so.',
      '',
      `Trip: "${trip.title}" (${trip.status}, ${trip.difficulty ?? 'difficulty unset'})`,
      trip.start_date && trip.end_date ? `Dates: ${trip.start_date} → ${trip.end_date}` : 'Dates: unset',
      trip.description ? `Description: ${trip.description.replace(/\s+/g, ' ').slice(0, 400)}` : '',
      `Rider's primary bike: ${bikeLine}`,
      '',
      'Itinerary:',
      dayLines.length ? dayLines.join('\n') : '  (no waypoints yet)',
    ]
      .filter(Boolean)
      .join('\n');
  }
}
