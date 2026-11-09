import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

/**
 * A ride's free derived stats, from its `ride_stats` row. An explicit allowlist:
 * Pro-group values (road-character bands, bends, lean, cells) are never fields
 * here; they reach clients only through `riderInsights` after the tier check.
 */
@ObjectType()
export class RideDerivedStats {
  @Field(() => Int, { nullable: true, description: 'Null without waypoints.' })
  movingTimeS: number | null;

  @Field(() => Float, { nullable: true, description: 'Distance over moving time.' })
  avgMovingSpeedMps: number | null;

  @Field(() => Float, { nullable: true })
  maxSpeedMps: number | null;

  @Field(() => Int, { nullable: true, description: 'Corrected climb, metres.' })
  climbM: number | null;

  @Field(() => Int, { nullable: true })
  descentM: number | null;

  @Field(() => Float, { nullable: true })
  gpsQuality: number | null;

  @Field(() => Int, { nullable: true })
  stopCount: number | null;
}
