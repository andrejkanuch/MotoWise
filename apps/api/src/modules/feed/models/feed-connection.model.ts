import { ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../../common/models/paginated.factory';
import { FeedRide } from './feed-ride.model';

@ObjectType()
export class FeedRideConnection extends Paginated(FeedRide, 'FeedRide') {}
