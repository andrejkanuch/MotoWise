import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { EntitlementsService } from './entitlements.service';
import { QuotaStatus } from './quota-status.dto';

@Resolver(() => QuotaStatus)
@UseGuards(GqlAuthGuard)
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
