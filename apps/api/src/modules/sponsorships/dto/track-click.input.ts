import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class TrackSponsorshipClickInput {
  @Field(() => ID)
  sponsorshipId: string;
}
