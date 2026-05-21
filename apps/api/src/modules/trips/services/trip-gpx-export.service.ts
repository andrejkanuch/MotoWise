import { GPX_EXPORT_LIMITS } from '@motovault/types';
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../../../common/decorators/current-user.decorator';
import { applySlugFilters } from '../../../common/slug-lookup';
import { EntitlementsService } from '../../entitlements/entitlements.service';
import { FEATURES } from '../../entitlements/entitlements.types';
import { SUPABASE_ADMIN } from '../../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../../supabase/supabase-user.provider';
import { GPXExportError, GPXExportSuccess } from '../dto/gpx-export.dto';

@Injectable()
export class TripGpxExportService {
  private readonly logger = new Logger(TripGpxExportService.name);

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    private readonly entitlementsService: EntitlementsService,
  ) {}

  async exportTripGPX(
    user: AuthUser,
    slug: string,
    country: string,
    region: string,
  ): Promise<GPXExportSuccess | GPXExportError> {
    // 1. Check feature entitlement (DOWNLOAD_GPX must be allowed for this tier)
    if (!this.entitlementsService.can(user, FEATURES.DOWNLOAD_GPX)) {
      return {
        code: 'ENTITLEMENT_DENIED',
        reason: 'GPX export requires authentication.',
        quotaRemaining: 0,
        upgradeUrl: '/pro/checkout',
      };
    }

    // 2. Check monthly quota (free tier = metered, Pro = unlimited)
    const quota = await this.entitlementsService.getGPXQuotaStatus(user.id, user.tier);
    if (quota.isExhausted) {
      return {
        code: 'QUOTA_EXCEEDED',
        reason: `Free plan allows ${GPX_EXPORT_LIMITS.FREE_MONTHLY_EXPORTS} GPX export per month. Upgrade to Pro for unlimited exports.`,
        quotaRemaining: 0,
        upgradeUrl: '/pro/checkout',
      };
    }

    // 3. Fetch trip + waypoints
    const tripQuery = this.supabase
      .from('trips')
      .select(
        'id, title, polyline, distance_m, elevation_gain_m, trip_waypoints(id, sort_order, day_index, type, name, lat, lng, notes)',
      )
      .eq('is_template', true)
      .eq('is_flagged', false);
    const { data: trip, error: tripError } = await applySlugFilters(
      tripQuery,
      country,
      region,
      slug,
    ).single();

    if (tripError || !trip) {
      throw new NotFoundException('Trip not found');
    }

    // 4. Decode polyline to track points
    const trackPoints = this.decodePolyline(trip.polyline ?? '');

    // 5. Build waypoint XML from trip_waypoints
    const waypoints =
      (
        (trip as Record<string, unknown>).trip_waypoints as Array<{
          sort_order: number;
          type: string;
          name: string;
          lat: number;
          lng: number;
          notes: string | null;
        }>
      )?.sort((a, b) => a.sort_order - b.sort_order) ?? [];

    // 6. Build GPX XML
    const tripName = trip.title ?? 'MotoVault Trip';
    const gpx = this.buildGpxXml(tripName, trackPoints, waypoints);
    const sanitizedName = tripName
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 75);
    const filename = `${sanitizedName}-motovault.gpx`;

    // 7. Record quota consumption BEFORE upload (fail-closed)
    const { error: quotaError } = await this.supabaseAdmin.from('user_gating_events').insert({
      user_id: user.id,
      feature: 'DOWNLOAD_GPX',
      trip_id: trip.id,
    });

    if (quotaError) {
      this.logger.error(`Failed to record GPX quota: ${quotaError.message}`);
      throw new InternalServerErrorException('Failed to record export — please try again.');
    }

    // 8. Upload to Supabase Storage + 9. Signed URL
    // Wrapped in try/catch: if upload or signing fails, roll back the quota record
    // so the user can retry without losing their monthly export.
    const storagePath = `gpx-exports/${user.id}/${trip.id}/${filename}`;
    try {
      const { error: uploadError } = await this.supabaseAdmin.storage
        .from('route-exports')
        .upload(storagePath, Buffer.from(gpx, 'utf-8'), {
          contentType: 'application/gpx+xml',
          upsert: true,
        });

      if (uploadError) {
        throw new InternalServerErrorException(`Upload failed: ${uploadError.message}`);
      }

      const { data: signedData, error: signError } = await this.supabaseAdmin.storage
        .from('route-exports')
        .createSignedUrl(storagePath, 3600);

      if (signError || !signedData?.signedUrl) {
        throw new InternalServerErrorException(`Signed URL failed: ${signError?.message}`);
      }

      const remaining = quota.remaining === -1 ? 'unlimited' : `${quota.remaining - 1}`;

      return {
        fileUrl: signedData.signedUrl,
        fileName: filename,
        message: `GPX export ready. ${remaining === 'unlimited' ? 'Unlimited exports with Pro.' : `${remaining} exports remaining this month.`}`,
      };
    } catch (err) {
      // Compensate: roll back quota record so user can retry
      await this.supabaseAdmin
        .from('user_gating_events')
        .delete()
        .eq('user_id', user.id)
        .eq('feature', 'DOWNLOAD_GPX')
        .eq('trip_id', trip.id);
      this.logger.error(`GPX export failed, quota rolled back: ${err}`);
      throw new InternalServerErrorException('Failed to export GPX file — please try again.');
    }
  }

  private decodePolyline(encoded: string): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lat += result & 1 ? ~(result >> 1) : result >> 1;

      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lng += result & 1 ? ~(result >> 1) : result >> 1;

      points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
  }

  private buildGpxXml(
    name: string,
    trackPoints: Array<[number, number]>,
    waypoints: Array<{
      type: string;
      name: string;
      lat: number;
      lng: number;
      notes: string | null;
    }>,
  ): string {
    const wpts = waypoints
      .map(
        (w) =>
          `  <wpt lat="${w.lat}" lon="${w.lng}">\n    <name>${this.escapeXml(w.name)}</name>\n    <type>${w.type}</type>${w.notes ? `\n    <desc>${this.escapeXml(w.notes)}</desc>` : ''}\n  </wpt>`,
      )
      .join('\n');

    const trkpts = trackPoints.map((p) => `      <trkpt lat="${p[0]}" lon="${p[1]}" />`).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoVault"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${this.escapeXml(name)}</name>
    <desc>Exported from MotoVault — motovault.app</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wpts}
  <trk>
    <name>${this.escapeXml(name)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
