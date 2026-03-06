import { Args, Query, Resolver } from '@nestjs/graphql';
import { ArticlesService } from './articles.service';
import { SearchArticlesInput } from './dto/search-articles.input';
import { Article } from './models/article.model';
import { ArticleConnection } from './models/article-connection.model';

@Resolver(() => Article)
export class ArticlesResolver {
  constructor(private readonly articlesService: ArticlesService) {}

  @Query(() => ArticleConnection)
  async searchArticles(@Args('input') input: SearchArticlesInput): Promise<ArticleConnection> {
    return this.articlesService.search(input);
  }

  @Query(() => Article, { nullable: true })
  async articleBySlug(@Args('slug') slug: string): Promise<Article | null> {
    return this.articlesService.findBySlug(slug);
  }
}
