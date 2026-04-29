import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (value === null || value === undefined) return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException('Please check your input and try again.');
    }
    return result.data;
  }
}
