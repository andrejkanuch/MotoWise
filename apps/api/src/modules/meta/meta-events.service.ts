import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const CAPI_TIMEOUT_MS = 5000;
const BUNDLE_ID = 'com.motovault.app';

@Injectable()
export class MetaEventsService {
  private readonly logger = new Logger(MetaEventsService.name);
  private readonly apiVersion = 'v19.0';

  constructor(private readonly config: ConfigService) {}

  private hash(value: string): string {
    return createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
  }

  async sendAppEvent(params: {
    eventName: 'CompleteRegistration' | 'StartTrial' | 'Subscribe';
    userEmail: string;
    userId: string;
    value?: number;
    currency?: string;
    fbclid?: string;
  }): Promise<void> {
    const datasetId = this.config.get<string>('META_DATASET_ID');
    const accessToken = this.config.get<string>('META_ACCESS_TOKEN');

    if (!datasetId || !accessToken) {
      this.logger.warn('META_DATASET_ID or META_ACCESS_TOKEN not configured — skipping CAPI event');
      return;
    }

    const { eventName, userEmail, userId, value, currency, fbclid } = params;

    const payload = {
      data: [
        {
          event_name: eventName,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'app',
          user_data: {
            em: [this.hash(userEmail)],
            external_id: [this.hash(userId)],
            ...(fbclid && { fbc: `fb.1.${Date.now()}.${fbclid}` }),
          },
          app_data: {
            advertiser_tracking_enabled: '1',
            application_tracking_enabled: '1',
            // Meta requires a 17-element positional array for extinfo.
            // Index 0: platform ('i2' = iOS, 'a2' = Android)
            // Index 1: bundle ID, Index 4: app version, Index 15: OS version
            // Server-side events use minimum required values; device-specific
            // fields are left empty since they're unknowable from the API.
            extinfo: [
              'i2',
              BUNDLE_ID,
              '',
              '',
              '3.0.0',
              '',
              '',
              '',
              '',
              '',
              '0',
              '',
              '',
              '',
              '',
              '16.0',
              '',
            ],
          },
          ...(value !== undefined && {
            custom_data: { value, currency: currency ?? 'USD' },
          }),
        },
      ],
      access_token: accessToken,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CAPI_TIMEOUT_MS);

    try {
      const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${datasetId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (!res.ok) {
        this.logger.error(`Meta CAPI error for ${eventName}`, data);
      } else {
        this.logger.log(`Meta CAPI ${eventName} sent for user ${userId}`);
      }
    } catch (err) {
      clearTimeout(timeout);
      this.logger.error(`Meta CAPI request failed for ${eventName}`, err);
    }
  }
}
