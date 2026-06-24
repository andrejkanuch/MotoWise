import {
  CreateBlogCategoryInputSchema,
  CreateBlogKeywordInputSchema,
  CreateBlogPostInputSchema,
  ScheduleBlogPostInputSchema,
  UpdateBlogPostInputSchema,
} from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BlogService } from './blog.service';
import { CreateBlogPostInput } from './dto/create-blog-post.input';
import { CreateBlogCategoryInput, CreateBlogKeywordInput } from './dto/create-taxonomy.input';
import { ListBlogPostsInput } from './dto/list-blog-posts.input';
import { ScheduleBlogPostInput } from './dto/schedule-blog-post.input';
import { UpdateBlogPostInput } from './dto/update-blog-post.input';
import { BlogCategory, BlogKeyword, BlogPost, BlogPostVersion } from './models/blog-post.model';
import { BlogPostConnection } from './models/blog-post-connection.model';

/**
 * Admin-only blog CMS resolver (plan U4). Class-level GqlAuthGuard validates the
 * JWT; the service's `assertAdmin` DB role check is the actual authorization gate
 * (the guard alone does not gate admin access). No method is `@Public()`.
 */
@UseGuards(GqlAuthGuard)
@Resolver(() => BlogPost)
export class BlogResolver {
  constructor(private readonly blogService: BlogService) {}

  @Query(() => BlogPostConnection)
  async adminBlogPosts(
    @CurrentUser() user: AuthUser,
    @Args('input', { nullable: true }) input?: ListBlogPostsInput,
  ): Promise<BlogPostConnection> {
    return this.blogService.adminList(user.id, input ?? {});
  }

  @Query(() => BlogPost, { nullable: true })
  async adminBlogPost(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<BlogPost | null> {
    return this.blogService.adminGet(user.id, id);
  }

  @Query(() => [BlogPostVersion])
  async adminBlogPostVersions(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<BlogPostVersion[]> {
    return this.blogService.listVersions(user.id, id);
  }

  @Query(() => [BlogCategory])
  async adminBlogCategories(@CurrentUser() user: AuthUser): Promise<BlogCategory[]> {
    return this.blogService.listCategories(user.id);
  }

  @Query(() => [BlogKeyword])
  async adminBlogKeywords(@CurrentUser() user: AuthUser): Promise<BlogKeyword[]> {
    return this.blogService.listKeywords(user.id);
  }

  @Mutation(() => BlogCategory)
  async createBlogCategory(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateBlogCategoryInputSchema))
    input: CreateBlogCategoryInput,
  ): Promise<BlogCategory> {
    return this.blogService.createCategory(user.id, input);
  }

  @Mutation(() => BlogKeyword)
  async createBlogKeyword(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateBlogKeywordInputSchema))
    input: CreateBlogKeywordInput,
  ): Promise<BlogKeyword> {
    return this.blogService.createKeyword(user.id, input);
  }

  @Mutation(() => BlogPost)
  async createBlogPost(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateBlogPostInputSchema)) input: CreateBlogPostInput,
  ): Promise<BlogPost> {
    return this.blogService.create(user.id, input);
  }

  @Mutation(() => BlogPost)
  async updateBlogPost(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateBlogPostInputSchema)) input: UpdateBlogPostInput,
  ): Promise<BlogPost> {
    return this.blogService.update(user.id, input);
  }

  @Mutation(() => BlogPost)
  async publishBlogPost(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<BlogPost> {
    return this.blogService.publish(user.id, id);
  }

  @Mutation(() => BlogPost)
  async scheduleBlogPost(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(ScheduleBlogPostInputSchema)) input: ScheduleBlogPostInput,
  ): Promise<BlogPost> {
    return this.blogService.schedule(user.id, input);
  }

  @Mutation(() => BlogPost)
  async unpublishBlogPost(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<BlogPost> {
    return this.blogService.unpublish(user.id, id);
  }

  @Mutation(() => Boolean)
  async deleteBlogPost(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<boolean> {
    return this.blogService.remove(user.id, id);
  }

  @Mutation(() => BlogPost)
  async revertBlogPostVersion(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
    @Args('versionNum', { type: () => Int }) versionNum: number,
  ): Promise<BlogPost> {
    return this.blogService.revertVersion(user.id, id, versionNum);
  }
}
