import { CreateContentFlagSchema } from '@motovault/types';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ContentFlagsService } from './content-flags.service';
import { CreateFlagInput } from './dto/create-flag.input';
import { ContentFlag } from './models/content-flag.model';

@Resolver(() => ContentFlag)
export class ContentFlagsResolver {
  constructor(private readonly contentFlagsService: ContentFlagsService) {}

  @Mutation(() => ContentFlag)
  async createFlag(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateContentFlagSchema)) input: CreateFlagInput,
  ): Promise<ContentFlag> {
    return this.contentFlagsService.create(user.id, input);
  }
}
