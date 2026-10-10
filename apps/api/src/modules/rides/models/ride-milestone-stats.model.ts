import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * What the ride-summary teaser needs to decide whether a milestone is due:
 * how many qualifying rides the rider has (optionally excluding the ride whose
 * summary is open, which the phone adds back from local data so the read works
 * before the server has the final row) and the longest of them.
 */
@ObjectType()
export class RideMilestoneStats {
  @Field(() => Int)
  qualifyingRideCount: number;

  @Field(() => Int)
  longestQualifyingDistanceM: number;
}
