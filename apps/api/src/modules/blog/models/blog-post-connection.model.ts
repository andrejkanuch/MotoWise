import { ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../../common/models/paginated.factory';
import { BlogPost } from './blog-post.model';

@ObjectType()
export class BlogPostConnection extends Paginated(BlogPost, 'BlogPost', { totalCount: true }) {}
