import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TripShareLink {
  @Field() token!: string;
  @Field() url!: string;
}
