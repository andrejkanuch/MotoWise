import { createUnionType, Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class GPXExportSuccess {
  @Field()
  fileUrl: string;

  @Field()
  fileName: string;

  @Field()
  message: string;
}

@ObjectType()
export class GPXExportError {
  @Field()
  code: string;

  @Field()
  reason: string;

  @Field(() => Int, { nullable: true })
  quotaRemaining?: number;

  @Field({ nullable: true })
  upgradeUrl?: string;
}

export const GPXExportResult = createUnionType({
  name: 'GPXExportResult',
  types: () => [GPXExportSuccess, GPXExportError] as const,
  resolveType(value) {
    if ('fileUrl' in value) return GPXExportSuccess;
    return GPXExportError;
  },
});
