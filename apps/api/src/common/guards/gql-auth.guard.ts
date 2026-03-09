import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class GqlAuthGuard implements CanActivate {
  private readonly supabaseUrl: string;
  private readonly legacySecret: Uint8Array;
  // biome-ignore lint/suspicious/noExplicitAny: jose's GetKeyFunction type is complex and dynamic-imported
  private jwks: any = null;
  private readonly reflector: Reflector;

  constructor(
    private configService: ConfigService,
    reflector: Reflector,
  ) {
    this.reflector = reflector;
    this.supabaseUrl = this.configService.getOrThrow('SUPABASE_URL');
    this.legacySecret = new TextEncoder().encode(
      this.configService.getOrThrow('SUPABASE_JWT_SECRET'),
    );
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
    if (isPublic) return true;

    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const { jwtVerify, decodeProtectedHeader } = await import('jose');

      let payload: Record<string, unknown>;

      const header = decodeProtectedHeader(token);
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

      request.user = {
        id: payload.sub,
        email: payload.email,
        // TODO 030 fix: prefer app_metadata.role (set by Supabase DB trigger, not user-editable)
        // over user_role claim. This value is INFORMATIONAL ONLY — do NOT use for authorization
        // decisions. All access control must go through RLS policies or a DB query on public.users.role.
        role:
          (payload.app_metadata as Record<string, unknown>)?.role ?? payload.user_role ?? 'user',
      };
      request.accessToken = token;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
