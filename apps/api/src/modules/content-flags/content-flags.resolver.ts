import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ContentFlagsService } from './content-flags.service';
import { CreateFlagInput } from './dto/create-flag.input';
import { ContentFlag } from './models/content-flag.model';

@Resolver(() => ContentFlag)
export class ContentFlagsResolver {
  constructor(private readonly contentFlagsService: ContentFlagsService) {}

  @Mutation(() => ContentFlag)
  @UseGuards(GqlAuthGuard)
  async createFlag(
    @CurrentUser() user: AuthUser,
    @Args('input') input: CreateFlagInput,
  ): Promise<ContentFlag> {
    return this.contentFlagsService.create(user.id, input);
  }
}
