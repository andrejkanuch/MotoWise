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
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
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

  private hs256Count = 0;
  private hs256LastLoggedAt = 0;

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

  /**
   * Retirement metric for the legacy HS256 shared-secret path: once Supabase finishes
   * the signing-key migration this counter flatlines and the branch can be deleted,
   * closing the permanent secret-leak downgrade surface. Logged hourly to avoid noise.
   */
  private countLegacyHs256Verification() {
    this.hs256Count++;
    const now = Date.now();
    if (now - this.hs256LastLoggedAt >= 3_600_000) {
      this.logger.warn(`Legacy HS256 JWT verifications since last report: ${this.hs256Count}`);
      this.hs256Count = 0;
      this.hs256LastLoggedAt = now;
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // REST controllers and GraphQL resolvers share this guard: REST routes stay
    // default-closed and must opt out with @Public() (webhooks carry their own HMAC auth).
    const request =
      context.getType<GqlContextType>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();
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

    // Algorithms are pinned PER PATH so a token with a forged `kid` (or an HS256 token
    // routed to the JWKS branch) can never verify against the wrong key material.
    // `audience: 'authenticated'` + required `sub` reject the public anon/service keys,
    // which are valid HS256 JWTs signed with the same secret but carry role claims only.
    const verifyOptions = {
      audience: 'authenticated',
      issuer: `${this.supabaseUrl}/auth/v1`,
    };

    const header = decodeProtectedHeader(token);
    if (header.kid) {
      // ECC/asymmetric key — verify against Supabase JWKS
      const jwks = await this.getJwks();
      const result = await jwtVerify(token, jwks, {
        ...verifyOptions,
        algorithms: ['ES256', 'RS256'],
      });
      payload = result.payload as Record<string, unknown>;
    } else {
      // Legacy HS256 — verify with shared secret
      const result = await jwtVerify(token, this.legacySecret, {
        ...verifyOptions,
        algorithms: ['HS256'],
      });
      payload = result.payload as Record<string, unknown>;
      this.countLegacyHs256Verification();
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedException('Token has no subject');
    }

    const userId = payload.sub;
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

      // A null expiry means no expiration (lifetime / comped grants) — treat it
      // as valid rather than letting `new Date(null)` coerce to 1970 and ALWAYS
      // read as expired, which silently downgraded active/trialing Pro users to
      // free.
      const notExpired =
        data.subscription_expires_at == null || new Date(data.subscription_expires_at) > new Date();

      const isPro =
        data.subscription_tier === 'pro' &&
        ['active', 'trialing'].includes(data.subscription_status) &&
        notExpired;

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
      // First pass: evict expired entries
      const now = Date.now();
      for (const [key, val] of this.tierCache) {
        if (val.expiresAt <= now) this.tierCache.delete(key);
      }
      // Second pass: if still over 75% capacity, evict oldest 25%
      if (this.tierCache.size >= this.TIER_CACHE_MAX_SIZE * 0.75) {
        const entries = [...this.tierCache.entries()].sort(
          (a, b) => a[1].expiresAt - b[1].expiresAt,
        );
        const evictCount = Math.ceil(entries.length * 0.25);
        for (let i = 0; i < evictCount; i++) {
          this.tierCache.delete(entries[i][0]);
        }
      }
    }
    this.tierCache.set(userId, { tier, expiresAt: Date.now() + this.TIER_CACHE_TTL_MS });
  }
}
