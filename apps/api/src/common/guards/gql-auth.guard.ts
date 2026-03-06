import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { jwtVerify } from 'jose';

@Injectable()
export class GqlAuthGuard implements CanActivate {
  private readonly secret: Uint8Array;

  constructor(private configService: ConfigService) {
    this.secret = new TextEncoder().encode(this.configService.getOrThrow('SUPABASE_JWT_SECRET'));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const { payload } = await jwtVerify(token, this.secret);
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.user_role ?? 'user',
      };
      request.accessToken = token;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
