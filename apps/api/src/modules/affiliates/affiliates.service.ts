import { AffiliatePartner } from '@motovault/types';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { TrackClickInput } from './dto/track-click.input';
import type { AffiliateProduct } from './models/affiliate-product.model';

/** Static affiliate tag mapping — never expose tags to the client */
const AFFILIATE_TAGS: Record<string, string> = {
  [AffiliatePartner.REVZILLA]: 'motovault-20',
  [AffiliatePartner.AMAZON]: 'motovault-20',
  [AffiliatePartner.ROCKY_MOUNTAIN]: 'motovault',
};

/** Allowed domains per affiliate partner — rejects unknown hosts */
const AFFILIATE_DOMAIN_ALLOWLIST: Record<string, string[]> = {
  [AffiliatePartner.REVZILLA]: ['www.revzilla.com', 'revzilla.com'],
  [AffiliatePartner.AMAZON]: ['www.amazon.com', 'amazon.com', 'smile.amazon.com'],
  [AffiliatePartner.ROCKY_MOUNTAIN]: ['www.rockymountainatvmc.com', 'rockymountainatvmc.com'],
};

@Injectable()
export class AffiliatesService {
  private readonly logger = new Logger(AffiliatesService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async trackClick(userId: string, input: TrackClickInput): Promise<AffiliateProduct> {
    const validPartners = Object.values(AffiliatePartner) as string[];
    if (!validPartners.includes(input.partner)) {
      throw new BadRequestException(`Invalid affiliate partner: ${input.partner}`);
    }

    this.logger.log(
      `trackClick: userId=${userId}, partner=${input.partner}, url=${input.productUrl}`,
    );

    const affiliateUrl = this.getAffiliateUrl(input.partner, input.productUrl);

    const { error } = await this.supabase.from('affiliate_clicks').insert({
      user_id: userId,
      partner: input.partner,
      product_url: input.productUrl,
      diagnosis_type: input.diagnosisType ?? null,
    });

    // Unique constraint violation (duplicate click same day) is non-fatal
    const isDuplicate = error?.code === '23505';

    if (error && !isDuplicate) {
      this.logger.error(`trackClick failed: ${error.message} (${error.code})`);
      throw new BadRequestException('Failed to track affiliate click');
    }

    if (isDuplicate) {
      this.logger.debug(`Duplicate click ignored: userId=${userId}, url=${input.productUrl}`);
    }

    return {
      partner: input.partner,
      affiliateUrl,
      productUrl: input.productUrl,
      tracked: !isDuplicate,
    };
  }

  /**
   * Build the affiliate tracking URL server-side.
   * Tags are never exposed to the client.
   */
  getAffiliateUrl(partner: string, productUrl: string): string {
    const tag = AFFILIATE_TAGS[partner];
    if (!tag) return productUrl;

    try {
      const url = new URL(productUrl);

      // Validate domain against allowlist for the given partner
      const allowedDomains = AFFILIATE_DOMAIN_ALLOWLIST[partner];
      if (allowedDomains && !allowedDomains.includes(url.hostname)) {
        throw new BadRequestException(
          `URL hostname "${url.hostname}" is not allowed for partner "${partner}"`,
        );
      }

      switch (partner) {
        case AffiliatePartner.REVZILLA:
          url.searchParams.set('ref', tag);
          break;
        case AffiliatePartner.AMAZON:
          url.searchParams.set('tag', tag);
          break;
        case AffiliatePartner.ROCKY_MOUNTAIN:
          url.searchParams.set('ref', tag);
          break;
        default:
          return productUrl;
      }

      return url.toString();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`Invalid product URL: ${productUrl}`);
      return productUrl;
    }
  }
}
