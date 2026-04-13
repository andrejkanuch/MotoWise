import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class TrackSponsorshipImpressionInput {
  @Field(() => ID)
  sponsorshipId: string;
}
