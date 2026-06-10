import type { Type } from '@nestjs/common';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import { PageInfo } from './page-info.model';

export interface PaginatedShape<TItem> {
  edges: { node: TItem; cursor: string }[];
  pageInfo: PageInfo;
  totalCount?: number;
}

/**
 * Generic Relay-connection factory. Produces an abstract `@ObjectType` carrying
 * `edges: [Edge{ node, cursor }]` + `pageInfo: PageInfo`, optionally with a
 * `totalCount`. Collapses the hand-written Edge+Connection pairs that all share
 * the same shared {@link PageInfo} model.
 *
 * Usage — `name` MUST be the existing SDL type name so the emitted schema stays
 * byte-identical:
 *
 *   @ObjectType()
 *   export class RideConnection extends Paginated(Ride, 'Ride', { totalCount: true }) {}
 *
 * The Edge type is emitted as `${name}Edge` (e.g. `RideEdge`); the connection
 * keeps the subclass name (`RideConnection`). Connections without `totalCount`
 * (e.g. FeedRideConnection) omit the field entirely rather than emitting it as
 * nullable, so the SDL is unchanged.
 */
export function Paginated<TItem>(
  classRef: Type<TItem>,
  name: string,
  options: { totalCount?: boolean } = {},
): Type<PaginatedShape<TItem>> {
  @ObjectType(`${name}Edge`)
  class EdgeType {
    @Field(() => classRef)
    node: TItem;

    @Field()
    cursor: string;
  }

  // `isAbstract` — this base is only ever extended by a concrete @ObjectType
  // (e.g. RideConnection), which is what registers in the schema.
  if (options.totalCount) {
    @ObjectType({ isAbstract: true })
    abstract class CountedConnection {
      @Field(() => [EdgeType])
      edges: EdgeType[];

      @Field(() => PageInfo)
      pageInfo: PageInfo;

      @Field(() => Int)
      totalCount: number;
    }
    return CountedConnection as Type<PaginatedShape<TItem>>;
  }

  @ObjectType({ isAbstract: true })
  abstract class PlainConnection {
    @Field(() => [EdgeType])
    edges: EdgeType[];

    @Field(() => PageInfo)
    pageInfo: PageInfo;
  }
  return PlainConnection as Type<PaginatedShape<TItem>>;
}
