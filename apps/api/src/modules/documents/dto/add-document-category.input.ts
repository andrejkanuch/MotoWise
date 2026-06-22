import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class AddDocumentCategoryInput {
  @Field()
  name: string;
}
