import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class LatLngInput {
  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lng: number;
}
