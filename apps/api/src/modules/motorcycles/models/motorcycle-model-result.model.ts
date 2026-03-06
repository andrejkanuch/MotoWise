import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MotorcycleModelResult {
  @Field(() => Int)
  modelId: number;

  @Field()
  modelName: string;
}
