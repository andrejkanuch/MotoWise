import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { DiagnosticsService } from './diagnostics.service';
import { CreateDiagnosticInput } from './dto/create-diagnostic.input';
import { Diagnostic } from './models/diagnostic.model';

@Resolver(() => Diagnostic)
export class DiagnosticsResolver {
  constructor(private readonly diagnosticsService: DiagnosticsService) {}

  @Query(() => [Diagnostic])
  @UseGuards(GqlAuthGuard)
  async myDiagnostics(@CurrentUser() user: AuthUser): Promise<Diagnostic[]> {
    return this.diagnosticsService.findByUser(user.id);
  }

  @Mutation(() => Diagnostic)
  @UseGuards(GqlAuthGuard)
  async createDiagnostic(
    @CurrentUser() user: AuthUser,
    @Args('input') input: CreateDiagnosticInput,
  ): Promise<Diagnostic> {
    return this.diagnosticsService.create(user.id, input);
  }
}
