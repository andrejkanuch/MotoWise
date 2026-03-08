import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SharedBikeInfo {
  @Field()
  make: string;

  @Field()
  model: string;

  @Field(() => Int)
  year: number;

  @Field({ nullable: true })
  nickname?: string;
}

@ObjectType()
export class SharedTaskInfo {
  @Field()
  title: string;

  @Field()
  status: string;

  @Field()
  priority: string;

  @Field({ nullable: true })
  dueDate?: string;

  @Field({ nullable: true })
  completedAt?: string;

  @Field(() => Int, { nullable: true })
  completedMileage?: number;

  @Field({ nullable: true })
  notes?: string;

  @Field(() => [String])
  photoUrls: string[];
}

@ObjectType()
export class SharedBikeHistory {
  @Field(() => SharedBikeInfo)
  bike: SharedBikeInfo;

  @Field(() => [SharedTaskInfo])
  tasks: SharedTaskInfo[];

  @Field()
  generatedAt: string;
}
