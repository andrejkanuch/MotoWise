import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class KudosResult {
  @Field()
  hasKudos: boolean;

  @Field(() => Int)
  kudosCount: number;
}
