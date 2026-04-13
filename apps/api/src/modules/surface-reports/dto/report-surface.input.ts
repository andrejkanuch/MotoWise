import { Field, ID, InputType } from '@nestjs/graphql';

@InputType()
export class ReportSurfaceInput {
  @Field(() => ID)
  routeId: string;

  @Field()
  condition: string;

  @Field({ nullable: true })
  note?: string;

  @Field({ nullable: true })
  photoUrl?: string;
}
