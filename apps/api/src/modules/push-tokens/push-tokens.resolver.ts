import { RegisterPushTokenSchema } from '@motovault/types';
import { Injectable, Scope } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RegisterPushTokenInput } from './dto/register-push-token.input';
import { RegisterPushTokenResult } from './models/register-push-token-result.model';
import { PushTokensService } from './push-tokens.service';

@Resolver(() => RegisterPushTokenResult)
@Injectable({ scope: Scope.REQUEST })
export class PushTokensResolver {
  constructor(private readonly pushTokensService: PushTokensService) {}

  @Mutation(() => RegisterPushTokenResult)
  async registerPushToken(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(RegisterPushTokenSchema))
    input: RegisterPushTokenInput,
  ): Promise<RegisterPushTokenResult> {
    const success = await this.pushTokensService.register(user.id, input);
    return { success };
  }
}
