import { ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../../common/models/paginated.factory';
import { Article } from './article.model';

@ObjectType()
export class ArticleConnection extends Paginated(Article, 'Article', { totalCount: true }) {}
