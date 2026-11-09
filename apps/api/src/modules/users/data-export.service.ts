import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { encodePolyline } from '../../common/polyline';
import { QUERY_LIMITS } from '../../config/constants';
import { EmailService } from '../email/email.service';
import { RIDE_STATS_TABLE, RIDE_TRACKS_TABLE } from '../ride-stats/ride-stats.types';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { DataExportRequest } from './models/data-export-request.model';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Derived ride stats in the export: every column except `cells` (an internal
 * index of H3 cells, not something a rider can read; the route below carries
 * the same location data).
 */
const RIDE_STATS_EXPORT_COLUMNS = [
  'ride_id',
  'motorcycle_id',
  'stats_version',
  'computed_at',
  'input_source',
  'wp_count',
  'wp_truncated',
  'time_zone',
  'local_date',
  'local_start_hour',
  'local_dow',
  'distance_m',
  'elapsed_s',
  'moving_time_s',
  'avg_moving_speed_mps',
  'max_speed_mps',
  'climb_m',
  'descent_m',
  'max_altitude_m',
  'min_altitude_m',
  'bends_count',
  'bends_per_km',
  'band_km',
  'lean_bands',
  'night_m',
  'stop_count',
  'stops',
  'countries',
  'start_region',
  'start_place',
  'end_place',
  'start_cell',
  'gps_quality',
  'gps_metrics',
  'weather',
  'weather_fetched_at',
  'temp_min_c',
  'temp_max_c',
  'wet',
].join(', ');

/** A `ride_tracks` row as PostgREST returns it: the geometry as GeoJSON. */
interface RideTrackExportRow {
  ride_id: string;
  source: string;
  built_at: string;
  route: { type?: string; coordinates?: Array<[number, number]> } | null;
}

/** Routes as encoded polylines (the format of `rides.route_polyline`), not raw geometry. */
function exportRoutes(rows: RideTrackExportRow[]) {
  return rows.map(({ ride_id, source, built_at, route }) => ({
    ride_id,
    source,
    built_at,
    route_polyline: Array.isArray(route?.coordinates)
      ? encodePolyline(route.coordinates.map(([lng, lat]) => ({ lat, lng })))
      : null,
  }));
}

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly emailService: EmailService,
  ) {}

  async requestDataExport(userId: string, email: string): Promise<DataExportRequest> {
    // Rate limit: 1 export per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentExports } = await this.supabase
      .from('data_export_requests')
      .select('id')
      .eq('user_id', userId)
      .gte('requested_at', twentyFourHoursAgo)
      .limit(1);

    if (recentExports && recentExports.length > 0) {
      throw new HttpException(
        'You can only request a data export once every 24 hours',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Create export request record
    const { data: exportReq, error } = await this.supabase
      .from('data_export_requests')
      .insert({ user_id: userId, status: 'pending' })
      .select()
      .single();

    if (error || !exportReq) {
      this.logger.error(`requestDataExport insert failed: ${JSON.stringify(error)}`);
      throw new BadRequestException('Failed to create data export request');
    }

    // Compile user data in background (using admin client for cross-table access)
    this.compileAndSendExport(userId, email, exportReq.id).catch((err) => {
      this.logger.error(`compileAndSendExport failed for ${exportReq.id}: ${err.message}`);
    });

    return {
      id: exportReq.id,
      userId: exportReq.user_id,
      status: exportReq.status,
      requestedAt: exportReq.requested_at,
      completedAt: exportReq.completed_at ?? undefined,
      createdAt: exportReq.created_at,
    };
  }

  private async compileAndSendExport(
    userId: string,
    email: string,
    exportId: string,
  ): Promise<void> {
    try {
      // Update status to processing
      await this.supabaseAdmin
        .from('data_export_requests')
        .update({ status: 'processing' })
        .eq('id', exportId);

      // userId is the verified JWT sub (always a UUID from Supabase), but the
      // follows export interpolates it into a PostgREST .or() filter string —
      // validate the shape as defense-in-depth before that one non-parameterized sink.
      if (!UUID_REGEX.test(userId)) {
        throw new BadRequestException('Invalid user id');
      }

      // Gather all user data
      const maxRows = QUERY_LIMITS.MAX_EXPORT_ROWS_PER_TABLE;
      const byUserId = (table: string) =>
        this.supabaseAdmin.from(table).select('*').eq('user_id', userId).limit(maxRows);

      const [
        profileResult,
        motorcyclesResult,
        maintenanceResult,
        diagnosticsResult,
        progressResult,
        quizAttemptsResult,
      ] = await Promise.all([
        this.supabaseAdmin.from('users').select('*').eq('id', userId).single(),
        byUserId('motorcycles'),
        byUserId('maintenance_tasks'),
        byUserId('diagnostics'),
        byUserId('learning_progress'),
        byUserId('quiz_attempts'),
      ]);

      const [expensesResult, ridesResult, commentsResult, rideKudosResult, surfaceReportsResult] =
        await Promise.all([
          byUserId('expenses'),
          byUserId('rides'),
          byUserId('comments'),
          byUserId('ride_kudos'),
          byUserId('surface_reports'),
        ]);

      const [tripsResult, followsResult] = await Promise.all([
        this.supabaseAdmin.from('trips').select('*').eq('organiser_user_id', userId).limit(maxRows),
        // Both directions: follows the user initiated AND follows of the user
        this.supabaseAdmin
          .from('follows')
          .select('*')
          .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
          .limit(maxRows),
      ]);

      // Document vault: metadata + storage paths only (not the raw file bytes).
      // document_files carries a denormalized user_id (00150) so byUserId works.
      // document_categories included too — custom category names are user data (GDPR).
      // feedback_messages: "Write to the developer" messages (00190). Copies already
      // in the support inbox are outside this export.
      const [
        documentsResult,
        documentFilesResult,
        documentCategoriesResult,
        feedbackMessagesResult,
      ] = await Promise.all([
        byUserId('documents'),
        byUserId('document_files'),
        byUserId('document_categories'),
        byUserId('feedback_messages'),
      ]);

      // Derived ride data (stats, stops, places, routes) is the rider's location
      // data too.
      const [rideStatsResult, rideTracksResult] = await Promise.all([
        this.supabaseAdmin
          .from(RIDE_STATS_TABLE)
          .select(RIDE_STATS_EXPORT_COLUMNS)
          .eq('user_id', userId)
          .limit(maxRows),
        this.supabaseAdmin
          .from(RIDE_TRACKS_TABLE)
          .select('ride_id, source, built_at, route')
          .eq('user_id', userId)
          .limit(maxRows),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: profileResult.data ?? null,
        motorcycles: motorcyclesResult.data ?? [],
        maintenanceTasks: maintenanceResult.data ?? [],
        diagnostics: diagnosticsResult.data ?? [],
        learningProgress: progressResult.data ?? [],
        quizAttempts: quizAttemptsResult.data ?? [],
        expenses: expensesResult.data ?? [],
        rides: ridesResult.data ?? [],
        trips: tripsResult.data ?? [],
        comments: commentsResult.data ?? [],
        follows: followsResult.data ?? [],
        rideKudos: rideKudosResult.data ?? [],
        surfaceReports: surfaceReportsResult.data ?? [],
        documents: documentsResult.data ?? [],
        documentFiles: documentFilesResult.data ?? [],
        documentCategories: documentCategoriesResult.data ?? [],
        feedbackMessages: feedbackMessagesResult.data ?? [],
        rideStats: rideStatsResult.data ?? [],
        rideRoutes: exportRoutes((rideTracksResult.data as RideTrackExportRow[] | null) ?? []),
      };

      // Store export as JSON in Supabase Storage
      const fileName = `exports/${userId}/${exportId}.json`;
      const { error: uploadError } = await this.supabaseAdmin.storage
        .from('user-exports')
        .upload(fileName, JSON.stringify(exportData), {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Generate signed URL (valid for 7 days)
      const { data: signedUrlData } = await this.supabaseAdmin.storage
        .from('user-exports')
        .createSignedUrl(fileName, 7 * 24 * 60 * 60);

      const downloadUrl = signedUrlData?.signedUrl ?? '';

      // Update export record as completed
      await this.supabaseAdmin
        .from('data_export_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          download_url: downloadUrl,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', exportId);

      // Send email with download link
      await this.emailService.sendDataExportReady(email, downloadUrl);
      this.logger.log(
        `Data export ${exportId} completed for user ${userId}. Email sent to ${email}.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Data export ${exportId} failed: ${message}`);
      await this.supabaseAdmin
        .from('data_export_requests')
        .update({ status: 'failed', error_message: message })
        .eq('id', exportId);
    }
  }
}
