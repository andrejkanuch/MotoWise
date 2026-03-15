import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (value === null || value === undefined) return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      console.error(
        '[ZodValidationPipe] Validation failed:',
        JSON.stringify(result.error.flatten(), null, 2),
      );
      throw new BadRequestException(result.error.flatten());
    }
    return result.data;
  }
}
