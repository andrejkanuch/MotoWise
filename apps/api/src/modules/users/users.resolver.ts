import { CompleteOnboardingInputSchema, UpdateUserSchema } from '@motolearn/types';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CompleteOnboardingInput } from './dto/complete-onboarding.input';
import { UpdateUserInput } from './dto/update-user.input';
import { DataExportRequest } from './models/data-export-request.model';
import { User } from './models/user.model';
import { UsersService } from './users.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async me(@CurrentUser() user: AuthUser): Promise<User> {
    return this.usersService.findById(user.id);
  }

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async user(@CurrentUser() authUser: AuthUser): Promise<User> {
    return this.usersService.findById(authUser.id);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async updateUser(
    @CurrentUser() authUser: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateUserSchema)) input: UpdateUserInput,
  ): Promise<User> {
    return this.usersService.update(authUser.id, input);
  }

  @Mutation(() => User)
  @UseGuards(GqlAuthGuard)
  async completeOnboarding(
    @CurrentUser() authUser: AuthUser,
    @Args('input', new ZodValidationPipe(CompleteOnboardingInputSchema))
    input: CompleteOnboardingInput,
  ): Promise<User> {
    return this.usersService.completeOnboarding(authUser.id, input);
  }

  @Mutation(() => DataExportRequest)
  @UseGuards(GqlAuthGuard)
  async requestDataExport(@CurrentUser() authUser: AuthUser): Promise<DataExportRequest> {
    return this.usersService.requestDataExport(authUser.id, authUser.email);
  }
}
