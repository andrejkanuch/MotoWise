import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tier } from '../../modules/entitlements/entitlements.types';
import { SUPABASE_ADMIN } from '../../modules/supabase/supabase-admin.provider';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class GqlAuthGuard implements CanActivate {
  private readonly logger = new Logger(GqlAuthGuard.name);
  private readonly supabaseUrl: string;
  private readonly legacySecret: Uint8Array;
  private readonly entitlementsEnforced: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: jose's GetKeyFunction type is complex and dynamic-imported
  private jwks: any = null;
  private readonly reflector: Reflector;

  private tierCache = new Map<string, { tier: Tier; expiresAt: number }>();
  private readonly TIER_CACHE_TTL_MS = 60_000;
  private readonly TIER_CACHE_MAX_SIZE = 10_000;

  constructor(
    private configService: ConfigService,
    reflector: Reflector,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {
    this.reflector = reflector;
    this.supabaseUrl = this.configService.getOrThrow('SUPABASE_URL');
    this.legacySecret = new TextEncoder().encode(
      this.configService.getOrThrow('SUPABASE_JWT_SECRET'),
    );
    this.entitlementsEnforced = this.configService.get('ENTITLEMENTS_ENFORCED', 'false') === 'true';

    if (!this.entitlementsEnforced) {
      this.logger.warn(
        'ENTITLEMENTS_ENFORCED is disabled — all authenticated users receive Pro tier. ' +
          'Set ENTITLEMENTS_ENFORCED=true in production to enable tier gating.',
      );
    }
  }

  private async getJwks() {
    if (!this.jwks) {
      const { createRemoteJWKSet } = await import('jose');
      this.jwks = createRemoteJWKSet(new URL(`${this.supabaseUrl}/auth/v1/.well-known/jwks.json`));
    }
    return this.jwks;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const authHeader = request.headers.authorization;

    if (isPublic) {
      // Attempt optional JWT extraction so @CurrentUser() works on public routes
      if (authHeader?.startsWith('Bearer ')) {
        try {
          await this.extractUser(request, authHeader.slice(7));
        } catch {
          // Invalid token on public route — proceed without user context
        }
      }
      return true;
    }

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.slice(7);

    try {
      await this.extractUser(request, token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private async extractUser(request: { user?: unknown; accessToken?: string }, token: string) {
    const { jwtVerify, decodeProtectedHeader } = await import('jose');

    let payload: Record<string, unknown>;

    const header = await decodeProtectedHeader(token);
    if (header.kid) {
      // ECC/asymmetric key — verify against Supabase JWKS
      const jwks = await this.getJwks();
      const result = await jwtVerify(token, jwks);
      payload = result.payload as Record<string, unknown>;
    } else {
      // Legacy HS256 — verify with shared secret
      const result = await jwtVerify(token, this.legacySecret);
      payload = result.payload as Record<string, unknown>;
    }

    const userId = payload.sub as string;
    const tier = await this.resolveEffectiveTier(userId);

    request.user = {
      id: userId,
      email: payload.email,
      // TODO 030 fix: prefer app_metadata.role (set by Supabase DB trigger, not user-editable)
      // over user_role claim. This value is INFORMATIONAL ONLY — do NOT use for authorization
      // decisions. All access control must go through RLS policies or a DB query on public.users.role.
      role: (payload.app_metadata as Record<string, unknown>)?.role ?? payload.user_role ?? 'user',
      tier,
    };
    request.accessToken = token;
  }

  /**
   * Resolve the effective subscription tier from the DB.
   * Checks subscription_tier + subscription_status + subscription_expires_at.
   * Returns 'pro' only when all three conditions are met.
   * Fails open to 'free' on error (never blocks a paying user due to a transient DB issue).
   */
  private async resolveEffectiveTier(userId: string): Promise<Tier> {
    if (!this.entitlementsEnforced) return 'pro'; // Feature flag off = everyone is Pro (Phase 1 behavior)

    const cached = this.tierCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.tier;

    try {
      const { data, error } = await this.supabaseAdmin
        .from('users')
        .select('subscription_tier, subscription_status, subscription_expires_at')
        .eq('id', userId)
        .single();

      if (error || !data) {
        this.logger.warn(`Tier resolution failed for ${userId}: ${error?.message ?? 'no data'}`);
        this.cacheTier(userId, 'free');
        return 'free'; // fail open
      }

      const isPro =
        data.subscription_tier === 'pro' &&
        ['active', 'trialing'].includes(data.subscription_status) &&
        new Date(data.subscription_expires_at) > new Date();

      const tier: Tier = isPro ? 'pro' : 'free';
      this.cacheTier(userId, tier);
      return tier;
    } catch (err) {
      this.logger.error(`Tier resolution error for ${userId}`, err);
      this.cacheTier(userId, 'free');
      return 'free'; // fail open
    }
  }

  private cacheTier(userId: string, tier: Tier): void {
    if (this.tierCache.size >= this.TIER_CACHE_MAX_SIZE) {
      this.tierCache.clear();
    }
    this.tierCache.set(userId, { tier, expiresAt: Date.now() + this.TIER_CACHE_TTL_MS });
  }
}
