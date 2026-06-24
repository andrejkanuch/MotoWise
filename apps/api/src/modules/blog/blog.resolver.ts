import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { BlogService } from './blog.service';
import { ListBlogPostsInput } from './dto/list-blog-posts.input';
import { BlogPost } from './models/blog-post.model';
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
}
