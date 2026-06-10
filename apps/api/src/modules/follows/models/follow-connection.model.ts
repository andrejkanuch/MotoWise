import { ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../../common/models/paginated.factory';
import { Follow } from './follow.model';

@ObjectType()
export class FollowConnection extends Paginated(Follow, 'Follow', { totalCount: true }) {}
