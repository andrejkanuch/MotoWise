import { Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EntitlementsService } from './entitlements.service';
import { QuotaStatus } from './quota-status.dto';

@Resolver()
export class EntitlementsResolver {
  constructor(private readonly entitlementsService: EntitlementsService) {}

  @Query(() => QuotaStatus, {
    name: 'getGPXQuotaStatus',
    description: 'Returns current GPX export quota usage and limits for the authenticated user',
  })
  async getGPXQuotaStatus(@CurrentUser() user: AuthUser): Promise<QuotaStatus> {
    return this.entitlementsService.getGPXQuotaStatus(user.id, user.tier);
  }
}
