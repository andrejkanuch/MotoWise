import { Module } from '@nestjs/common';
import { ArticleGeneratorService } from './article-generator.service';
import { ArticlesResolver } from './articles.resolver';
import { ArticlesService } from './articles.service';

@Module({
  providers: [ArticlesResolver, ArticlesService, ArticleGeneratorService],
})
export class ArticlesModule {}
