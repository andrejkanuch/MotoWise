import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GqlUserRole } from '../../../common/enums/graphql-enums';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  fullName?: string;

  @Field(() => GqlUserRole)
  role: string;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
