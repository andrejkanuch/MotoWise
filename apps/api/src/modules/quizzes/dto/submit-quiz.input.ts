import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class SubmitQuizInput {
  @Field()
  quizId: string;

  @Field(() => [Int])
  answers: number[];
}
