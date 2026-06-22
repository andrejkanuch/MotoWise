import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UpdateDocumentCategoryInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  isHidden?: boolean;
}
