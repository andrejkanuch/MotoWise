import { WeatherForecastInputSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { WeatherForecastInput } from './dto/weather-forecast.input';
import { WeatherForecast } from './models/weather-forecast.model';
import { WeatherService } from './weather.service';

@Resolver(() => WeatherForecast)
export class WeatherResolver {
  constructor(private readonly weatherService: WeatherService) {}

  @Query(() => WeatherForecast, {
    description:
      'Five-day daily forecast near a point (Discover weather strip, pre-ride check). The point is rounded to 0.1° before the provider call.',
  })
  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.WEATHER })
  async weatherForecast(
    @Args('input', new ZodValidationPipe(WeatherForecastInputSchema)) input: WeatherForecastInput,
  ): Promise<WeatherForecast> {
    return this.weatherService.getForecast(input.lat, input.lon);
  }
}
