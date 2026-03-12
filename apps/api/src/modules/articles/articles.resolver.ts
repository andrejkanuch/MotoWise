import { GenerateArticleSchema } from '@motovault/types';
import { BadRequestException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ArticleGeneratorService } from './article-generator.service';
import { ArticlesService } from './articles.service';
import { GenerateArticleInput } from './dto/generate-article.input';
import { SearchArticlesInput } from './dto/search-articles.input';
import { Article } from './models/article.model';
import { ArticleConnection } from './models/article-connection.model';

@Resolver(() => Article)
export class ArticlesResolver {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly articleGeneratorService: ArticleGeneratorService,
  ) {}

  /** Public: articles are educational content accessible without authentication */
  @Query(() => ArticleConnection)
  @UseGuards(GqlAuthGuard)
  @Public()
  async searchArticles(@Args('input') input: SearchArticlesInput): Promise<ArticleConnection> {
    return this.articlesService.search(input);
  }

  /** Public: article detail by slug for web and mobile learn tab */
  @Query(() => Article, { nullable: true })
  @UseGuards(GqlAuthGuard)
  @Public()
  async articleBySlug(@Args('slug') slug: string): Promise<Article | null> {
    return this.articlesService.findBySlug(slug);
  }

  /** Public: full article content by slug for web and mobile learn tab */
  @Query(() => Article, { nullable: true })
  @UseGuards(GqlAuthGuard)
  @Public()
  async articleBySlugFull(@Args('slug') slug: string): Promise<Article | null> {
    return this.articlesService.findBySlugFull(slug);
  }

  @Mutation(() => Article)
  @UseGuards(GqlAuthGuard)
  @Throttle({ ai: { ttl: 60000, limit: 5 } })
  async generateArticle(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(GenerateArticleSchema)) input: GenerateArticleInput,
  ): Promise<Article> {
    // Check for existing similar articles before generating
    const similar = await this.articlesService.findSimilar(input.topic);
    if (similar.length > 0) {
      throw new BadRequestException(
        `Similar article already exists: "${similar[0].title}". Slug: ${similar[0].slug}`,
      );
    }

    return this.articleGeneratorService.generate(
      user.id,
      input.topic,
      input.category,
      input.difficulty,
    );
  }
}
