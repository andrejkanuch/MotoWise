import { Field, Float, InputType } from '@nestjs/graphql';

@InputType()
export class WeatherForecastInput {
  @Field(() => Float)
  lat: number;

  @Field(() => Float)
  lon: number;
}
