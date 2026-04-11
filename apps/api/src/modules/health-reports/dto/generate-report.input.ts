import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class GenerateReportInput {
  @Field()
  bikeId: string;
}
