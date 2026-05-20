import {
  CompleteOnboardingInputSchema,
  UpdateHandleInputSchema,
  UpdateProfileInputSchema,
  UpdateUserSchema,
} from '@motovault/types';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CompleteOnboardingInput } from './dto/complete-onboarding.input';
import { UpdateHandleInput } from './dto/update-handle.input';
import { UpdateProfileInput } from './dto/update-profile.input';
import { UpdateUserInput } from './dto/update-user.input';
import { DataExportRequest } from './models/data-export-request.model';
import { PublicRiderProfile } from './models/public-rider-profile.model';
import { User } from './models/user.model';
import { UsersService } from './users.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => User)
  async me(@CurrentUser() user: AuthUser): Promise<User> {
    return this.usersService.findById(user.id);
  }

  @Query(() => User)
  async user(@CurrentUser() authUser: AuthUser): Promise<User> {
    return this.usersService.findById(authUser.id);
  }

  @Mutation(() => User)
  async updateUser(
    @CurrentUser() authUser: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateUserSchema)) input: UpdateUserInput,
  ): Promise<User> {
    return this.usersService.update(authUser.id, input);
  }

  @Mutation(() => User)
  async completeOnboarding(
    @CurrentUser() authUser: AuthUser,
    @Args('input', new ZodValidationPipe(CompleteOnboardingInputSchema))
    input: CompleteOnboardingInput,
  ): Promise<User> {
    return this.usersService.completeOnboarding(authUser.id, input);
  }

  @Mutation(() => DataExportRequest)
  async requestDataExport(@CurrentUser() authUser: AuthUser): Promise<DataExportRequest> {
    return this.usersService.requestDataExport(authUser.id, authUser.email);
  }

  @Mutation(() => Boolean)
  async deleteAccount(@CurrentUser() authUser: AuthUser): Promise<boolean> {
    return this.usersService.deleteAccount(authUser.id, authUser.email);
  }

  @Query(() => PublicRiderProfile)
  @Public()
  async getRiderProfile(
    @Args('username') username: string,
    @CurrentUser() user?: AuthUser,
  ): Promise<PublicRiderProfile> {
    return this.usersService.getRiderProfile(username, user?.id);
  }

  @Mutation(() => User)
  async updateMyProfile(
    @CurrentUser() authUser: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateProfileInputSchema)) input: UpdateProfileInput,
  ): Promise<User> {
    return this.usersService.updateProfile(authUser.id, input);
  }

  @Mutation(() => User)
  async updateHandle(
    @CurrentUser() authUser: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateHandleInputSchema)) input: UpdateHandleInput,
  ): Promise<User> {
    return this.usersService.updateHandle(authUser.id, input.handle);
  }
}
