import { ObjectType } from '@nestjs/graphql';
import { Paginated } from '../../../common/models/paginated.factory';
import { Ride } from './ride.model';

@ObjectType()
export class RideConnection extends Paginated(Ride, 'Ride', { totalCount: true }) {}
