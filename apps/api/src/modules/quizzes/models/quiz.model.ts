import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class QuizQuestion {
  @Field()
  question: string;

  @Field(() => [String])
  options: string[];

  @Field()
  explanation: string;
}

@ObjectType()
export class Quiz {
  @Field(() => ID)
  id: string;

  @Field()
  articleId: string;

  @Field(() => [QuizQuestion])
  questions: QuizQuestion[];

  @Field()
  generatedAt: string;
}

@ObjectType()
export class QuizAttempt {
  @Field(() => ID)
  id: string;

  @Field()
  quizId: string;

  @Field()
  score: number;

  @Field()
  totalQuestions: number;

  @Field()
  completedAt: string;
}
