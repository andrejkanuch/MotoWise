import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'One day of the forecast, in the local time zone of the point.' })
export class WeatherDay {
  @Field({ description: 'Local calendar date, YYYY-MM-DD.' })
  date!: string;

  @Field(() => Float, { description: 'Maximum temperature, °C.' })
  tempMax!: number;

  @Field(() => Float, { description: 'Minimum temperature, °C.' })
  tempMin!: number;

  @Field(() => Int, {
    nullable: true,
    description:
      'Highest chance of precipitation in the day, 0-100. Null when the provider has no value.',
  })
  precipProbability!: number | null;

  @Field(() => Int, { description: 'WMO weather interpretation code.' })
  weatherCode!: number;
}

@ObjectType({ description: 'Daily weather forecast near a point.' })
export class WeatherForecast {
  @Field(() => [WeatherDay])
  days!: WeatherDay[];
}
