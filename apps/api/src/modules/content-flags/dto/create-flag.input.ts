import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class CreateFlagInput {
  @Field()
  articleId: string;

  @Field({ nullable: true })
  sectionReference?: string;

  @Field()
  comment: string;
}
